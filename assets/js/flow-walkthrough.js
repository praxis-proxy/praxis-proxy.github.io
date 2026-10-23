const accent = "#4338ca";
const border = "#dce2eb";

export function init(root) {
  if (root.dataset.flowReady) return;
  const controls = root.querySelector("[data-flow-controls]");
  const status = root.querySelector("[data-flow-status]");
  const stepsRoot = root.closest(".flow-walkthrough");
  const radios = [...controls.querySelectorAll('input[name="flow-scenario"]')];
  const buttons = [...controls.querySelectorAll("[data-flow-action]")];
  const steps = [...stepsRoot.querySelectorAll("[data-flow-step]")];
  const nodes = [...root.querySelectorAll("[data-flow-node]")];
  const paths = [...root.querySelectorAll("[data-flow-path]")];
  let index = 0;

  function render() {
    const scenario = radios.find((radio) => radio.checked).value;
    const current = steps.filter((step) => step.dataset.scenario === scenario);
    const step = current[index];
    const focus = step.dataset.flowFocus;
    steps.forEach((item) => {
      if (item.dataset.scenario === scenario && item.dataset.index === String(index)) {
        item.setAttribute("aria-current", "step");
      } else {
        item.removeAttribute("aria-current");
      }
    });
    nodes.forEach((node) => {
      const active = node.dataset.flowNode === focus;
      const shape = node.querySelector("rect");
      shape.setAttribute("stroke", active ? accent : border);
      shape.setAttribute("stroke-width", active ? "4" : "2");
    });
    paths.forEach((path) => path.setAttribute("opacity", path.dataset.flowPath === "fallback" && scenario === "primary" ? ".28" : "1"));
    status.textContent = `${scenario === "primary" ? "Primary succeeds" : "Primary returns a retryable status"}. Step ${index + 1} of ${current.length}: ${step.textContent.trim()}`;
    buttons.find((button) => button.dataset.flowAction === "previous").disabled = index === 0;
    buttons.find((button) => button.dataset.flowAction === "next").disabled = index === current.length - 1;
  }

  controls.addEventListener("click", (event) => {
    const action = event.target.closest("[data-flow-action]")?.dataset.flowAction;
    if (action === "previous") index--;
    if (action === "next") index++;
    if (action === "reset") index = 0;
    if (action) render();
  });
  radios.forEach((radio) => radio.addEventListener("change", () => { index = 0; render(); }));
  root.dataset.flowReady = "true";
  controls.hidden = false;
  render();
}
