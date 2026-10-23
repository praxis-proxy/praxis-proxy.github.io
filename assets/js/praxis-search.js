(() => {
  const root = document.querySelector("[data-praxis-search]");
  if (!root) return;

  const dialog = root.querySelector("#praxis-search-dialog");
  const diagramDialog = root.querySelector("#praxis-diagram-dialog");
  const diagramCanvas = root.querySelector("[data-praxis-diagram-canvas]");
  const manifestURL = root.dataset.praxisSearchManifestSrc;
  const lunrURL = document.querySelector("[data-praxis-lunr]")?.src;
  const pageHref = root.querySelector("[data-praxis-search-page]")?.href || "/search/";
  let manifestPromise;
  let lunrPromise = window.lunr ? Promise.resolve(window.lunr) : null;
  let returnFocus;
  let diagramReturnFocus;
  const indexCache = new Map();
  const formInit = new WeakMap();
  const searchGeneration = new WeakMap();
  const versionGeneration = new WeakMap();
  const diagramSources = new WeakMap();
  const resultState = new WeakMap();

  const getManifest = () => {
    if (!manifestPromise) {
      manifestPromise = fetch(manifestURL).then((response) => {
        if (!response.ok) throw new Error(`Search manifest: ${response.status}`);
        return response.json();
      }).catch((error) => {
        manifestPromise = null;
        throw error;
      });
    }
    return manifestPromise;
  };

  function loadLunr() {
    if (window.lunr) return Promise.resolve(window.lunr);
    if (!lunrPromise) {
      lunrPromise = new Promise((resolve, reject) => {
        if (!lunrURL) return reject(new Error("Local search engine URL is missing"));
        const script = document.createElement("script");
        script.src = lunrURL;
        script.onload = () => window.lunr ? resolve(window.lunr) : reject(new Error("Local search engine did not initialize"));
        script.onerror = () => reject(new Error("Local search engine failed to load"));
        document.head.append(script);
      }).catch((error) => {
        lunrPromise = null;
        throw error;
      });
    }
    return lunrPromise;
  }

  function setStatus(form, message, state = "") {
    const status = form.querySelector("[data-praxis-status]");
    status.textContent = message;
    status.dataset.state = state;
  }

  function currentURLState() {
    const params = new URLSearchParams(location.search);
    return location.pathname.includes("/search") ? {
      query: params.get("q") || "",
      product: params.get("product") || "",
      version: params.get("version") || "",
      form: params.get("form") || "",
    } : { query: "", product: "", version: "", form: "" };
  }

  async function setVersionOptions(form, product, preferred = "") {
    const generation = (versionGeneration.get(form) || 0) + 1;
    versionGeneration.set(form, generation);
    const select = form.querySelector("[data-praxis-version]");
    const wrap = form.querySelector("[data-praxis-version-wrap]");
    select.replaceChildren();
    if (product === "all") {
      select.disabled = true;
      wrap.hidden = true;
      return;
    }
    const data = await getManifest();
    if (versionGeneration.get(form) !== generation || form.querySelector("[data-praxis-product]").value !== product) return;
    const productData = data.products[product];
    if (!productData) throw new Error("Unknown project search scope");
    for (const version of productData.versions) {
      const option = document.createElement("option");
      option.value = version.slug;
      option.textContent = version.label;
      select.append(option);
    }
    const valid = productData.versions.some((version) => version.slug === preferred);
    select.value = valid ? preferred : productData.default;
    select.disabled = false;
    wrap.hidden = false;
  }

  async function initForm(form, preserve = false) {
    const state = currentURLState();
    const productSelect = form.querySelector("[data-praxis-product]");
    const query = form.querySelector("[data-praxis-query]");
    const formSelect = form.querySelector("[data-praxis-form]");
    const requestedProduct = (preserve ? productSelect.value : state.product) || root.dataset.praxisSearchDefaultProduct || "all";
    const product = Array.from(productSelect.options).some((item) => item.value === requestedProduct) ? requestedProduct : "all";
    productSelect.value = product;
    if (!preserve) {
      query.value = state.query;
      formSelect.value = state.form;
    }
    const preferredVersion = preserve ? form.querySelector("[data-praxis-version]").value : state.version || (product === root.dataset.praxisSearchDefaultProduct ? root.dataset.praxisSearchDefaultVersion : "");
    await setVersionOptions(form, product, preferredVersion);
    if (state.query && form.dataset.praxisSearchMode === "page") runSearch(form);
  }

  function ensureFormReady(form) {
    if (!formInit.has(form)) {
      const preserve = form.dataset.praxisInitialized === "true";
      form.dataset.praxisInitialized = "true";
      const ready = initForm(form, preserve).catch((error) => {
        formInit.delete(form);
        setStatus(form, "Search filters are unavailable. Retry when connected.", "error");
        form.querySelector("[data-praxis-retry]").hidden = false;
        throw error;
      });
      formInit.set(form, ready);
    }
    return formInit.get(form);
  }

  async function loadScope(product, version) {
    const manifest = await getManifest();
    const scope = product === "all" ? { key: "all", url: manifest.all } : {
      key: `${product}/${version}`,
      url: manifest.products[product]?.versions.find((entry) => entry.slug === version)?.url,
    };
    if (!scope.url) throw new Error("The selected documentation version is unavailable");
    if (!indexCache.has(scope.key)) {
      const request = fetch(scope.url).then((response) => {
        if (!response.ok) throw new Error(`Search index: ${response.status}`);
        return response.json();
      }).then((documents) => {
        if (!window.lunr) throw new Error("The local search engine did not load");
        const byRef = new Map(documents.map((doc) => [doc.ref, doc]));
        const index = window.lunr(function () {
          this.ref("ref");
          this.field("title", { boost: 12 });
          this.field("headings", { boost: 8 });
          this.field("description", { boost: 4 });
          this.field("product_name", { boost: 2 });
          this.field("body");
          documents.forEach((doc) => this.add(doc));
        });
        return { index, byRef };
      }).catch((error) => {
        indexCache.delete(scope.key);
        throw error;
      });
      indexCache.set(scope.key, request);
    }
    return indexCache.get(scope.key);
  }

  function makeSnippet(doc, terms) {
    const text = (doc.body || doc.description || "").replace(/\s+/g, " ").trim();
    const lower = text.toLocaleLowerCase();
    const hit = terms.map((term) => lower.indexOf(term)).filter((position) => position >= 0).sort((a, b) => a - b)[0] ?? 0;
    const start = Math.max(0, hit - 65);
    const end = Math.min(text.length, start + 190);
    return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
  }

  function updateShareLink(form, query) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("product", data.get("product") || "all");
    if (data.get("product") !== "all") params.set("version", data.get("version") || "");
    if (data.get("form")) params.set("form", data.get("form"));
    const url = new URL(pageHref, location.href);
    url.search = params.toString();
    root.querySelectorAll("[data-praxis-search-page]").forEach((link) => { link.href = url.href; });
    if (form.dataset.praxisSearchMode === "page") history.replaceState(null, "", url.href);
  }

  function renderResults(form, matches, docs, terms, start = 0) {
    const list = form.querySelector("[data-praxis-results]");
    const end = Math.min(start + 10, matches.length);
    if (start === 0) list.replaceChildren();
    for (const result of matches.slice(start, end)) {
      const doc = docs.get(result.ref);
      if (!doc) continue;
      const item = document.createElement("li");
      item.className = "praxis-search__result";
      const link = document.createElement("a");
      link.href = doc.ref;
      link.textContent = doc.title;
      const snippet = document.createElement("p");
      snippet.textContent = makeSnippet(doc, terms);
      const badges = document.createElement("p");
      badges.className = "praxis-search__badges";
      const labels = [doc.product_name || "Praxis", doc.version_label || (doc.version ? doc.version : "Overview"), doc.reader_need].filter(Boolean);
      for (const label of labels) {
        const badge = document.createElement("span");
        badge.className = "praxis-search__badge";
        badge.textContent = label;
        badges.append(badge);
      }
      item.append(link, snippet, badges);
      list.append(item);
    }
    resultState.set(form, { matches, docs, terms, shown: end });
    form.querySelector("[data-praxis-more]").hidden = end >= matches.length;
    if (matches.length) setStatus(form, `Showing ${end} of ${matches.length} results.`, "results");
  }

  async function runSearch(form) {
    if (form.dataset.praxisSearchMode === "dialog") {
      try { await ensureFormReady(form); } catch (_) { return; }
    }
    const generation = (searchGeneration.get(form) || 0) + 1;
    searchGeneration.set(form, generation);
    const query = form.querySelector("[data-praxis-query]").value.trim();
    const results = form.querySelector("[data-praxis-results]");
    const retry = form.querySelector("[data-praxis-retry]");
    results.replaceChildren();
    resultState.delete(form);
    retry.hidden = true;
    form.querySelector("[data-praxis-more]").hidden = true;
    if (!query) {
      setStatus(form, "Enter a search term.");
      return;
    }
    const product = form.querySelector("[data-praxis-product]").value;
    const version = form.querySelector("[data-praxis-version]").value;
    const readerNeed = form.querySelector("[data-praxis-form]").value;
    setStatus(form, "Loading documentation search…", "loading");
    try {
      const lunr = await loadLunr();
      const terms = lunr.tokenizer(query).map((token) => lunr.stemmer(token).toString().toLocaleLowerCase());
      if (!terms.length) {
        setStatus(form, "Enter a search term containing letters or numbers.", "empty");
        return;
      }
      updateShareLink(form, query);
      const { index, byRef } = await loadScope(product, version);
      if (searchGeneration.get(form) !== generation) return;
      const matches = index.query((queryBuilder) => {
        terms.forEach((term) => queryBuilder.term(term, {
          wildcard: lunr.Query.wildcard.TRAILING,
          presence: lunr.Query.presence.OPTIONAL,
        }));
      }).filter((match) => !readerNeed || byRef.get(match.ref)?.reader_need === readerNeed)
        .sort((left, right) => right.score - left.score);
      renderResults(form, matches, byRef, terms);
      if (!matches.length) setStatus(form, "No results. Try another query or change the filters.", "empty");
    } catch (error) {
      if (searchGeneration.get(form) !== generation) return;
      setStatus(form, "Search is unavailable. Check your connection and retry.", "error");
      retry.hidden = false;
    }
  }

  function buildDiagramButton(source, type) {
    if (source.dataset.praxisDiagramZoomed) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "praxis-diagram-zoom";
    button.textContent = "Enlarge diagram";
    const label = source.closest("figure")?.querySelector("figcaption")?.textContent.trim() || source.alt || "diagram";
    button.setAttribute("aria-label", `Enlarge diagram: ${label}`);
    button.dataset.diagramType = type;
    diagramSources.set(button, source);
    source.dataset.praxisDiagramZoomed = "true";
    const placement = type === "image" ? (source.closest(".guide-figure__scroll") || source.closest("a") || source) : source;
    placement.insertAdjacentElement("afterend", button);
  }

  function addDiagramControls() {
    document.querySelectorAll("main figure img[src$='.svg' i], main .td-content img[src$='.svg' i], main .product-visual__scroll img[src$='.svg' i], main .home-diagram__scroll img[src$='.svg' i]")
      .forEach((image) => buildDiagramButton(image, "image"));
    document.querySelectorAll("main pre.mermaid svg").forEach((svg) => {
      const pre = svg.closest("pre.mermaid");
      if (pre) buildDiagramButton(pre, "mermaid");
    });
  }

  function renameSVGIDs(svg) {
    const ids = new Map();
    const elements = [svg, ...svg.querySelectorAll("*")];
    elements.filter((element) => element.id).forEach((element, index) => {
      const oldID = element.id;
      const newID = `enlarged-${Date.now()}-${index}`;
      ids.set(oldID, newID);
      element.id = newID;
    });
    elements.forEach((element) => {
      for (const attribute of Array.from(element.attributes)) {
        let value = attribute.value.replace(/url\(#([^)]+)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
        if ((attribute.name === "href" || attribute.name === "xlink:href") && value.startsWith("#")) {
          value = `#${ids.get(value.slice(1)) || value.slice(1)}`;
        }
        if (attribute.name === "aria-labelledby" || attribute.name === "aria-describedby") {
          value = value.split(/\s+/).map((id) => ids.get(id) || id).join(" ");
        }
        element.setAttribute(attribute.name, value);
      }
    });
  }

  document.addEventListener("click", async (event) => {
    const open = event.target.closest("[data-praxis-search-open], [data-search-dialog-trigger]");
    if (open) {
      event.preventDefault();
      returnFocus = open;
      if (!dialog.open) dialog.showModal();
      const form = dialog.querySelector("[data-praxis-search-form]");
      form.querySelector("[data-praxis-query]").focus();
      ensureFormReady(form).catch(() => {});
      return;
    }
    if (event.target.closest("[data-praxis-search-close]")) dialog.close();
    if (event.target.closest("[data-praxis-retry]")) {
      const form = event.target.closest("form");
      ensureFormReady(form).then(() => runSearch(form)).catch(() => {});
    }
    if (event.target.closest("[data-praxis-more]")) {
      const form = event.target.closest("form");
      const state = resultState.get(form);
      if (state) renderResults(form, state.matches, state.docs, state.terms, state.shown);
    }

    const zoom = event.target.closest(".praxis-diagram-zoom");
    if (!zoom) return;
    const source = diagramSources.get(zoom);
    const type = zoom.dataset.diagramType;
    const figure = source.closest("figure");
    const image = type === "image" ? source : null;
    const caption = figure?.querySelector("figcaption")?.textContent.trim() || image?.alt || "Enlarged diagram";
    root.querySelector("#praxis-diagram-title").textContent = caption;
    diagramCanvas.replaceChildren();
    const copy = type === "image" ? image.cloneNode(true) : source.querySelector("svg")?.cloneNode(true);
    if (!copy) return;
    if (type === "mermaid") {
      renameSVGIDs(copy);
      copy.setAttribute("role", "img");
      copy.setAttribute("aria-label", caption);
    }
    copy.classList.add("praxis-diagram-dialog__image");
    diagramCanvas.append(copy);
    diagramReturnFocus = zoom;
    diagramDialog.showModal();
    root.querySelector("[data-praxis-diagram-close]").focus();
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-praxis-search-form]");
    if (!form) return;
    event.preventDefault();
    runSearch(form);
  });

  document.addEventListener("change", (event) => {
    const form = event.target.closest("[data-praxis-search-form]");
    if (!form) return;
    searchGeneration.set(form, (searchGeneration.get(form) || 0) + 1);
    if (event.target.matches("[data-praxis-product]")) {
      setVersionOptions(form, event.target.value).then(() => {
        if (form.querySelector("[data-praxis-query]").value.trim()) runSearch(form);
      }).catch(() => {
        setStatus(form, "Search scopes are unavailable. Retry when connected.", "error");
        form.querySelector("[data-praxis-retry]").hidden = false;
      });
    } else if (form.querySelector("[data-praxis-query]").value.trim()) {
      runSearch(form);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialog.open) {
      event.preventDefault();
      dialog.close();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      const trigger = document.querySelector("[data-praxis-search-open], [data-search-dialog-trigger]");
      if (trigger) trigger.click();
    }
  });

  dialog.addEventListener("close", () => returnFocus?.focus());
  root.querySelector("[data-praxis-search-close]").addEventListener("click", () => dialog.close());
  root.querySelector("[data-praxis-diagram-close]").addEventListener("click", () => diagramDialog.close());
  diagramDialog.addEventListener("close", () => diagramReturnFocus?.focus());
  diagramDialog.addEventListener("click", (event) => { if (event.target === diagramDialog) diagramDialog.close(); });

  const pageForms = Array.from(document.querySelectorAll('[data-praxis-search-form][data-praxis-search-mode="page"]'));
  Promise.all(pageForms.map((form) => ensureFormReady(form).catch(() => {})));
  addDiagramControls();
  new MutationObserver(addDiagramControls).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });
})();
