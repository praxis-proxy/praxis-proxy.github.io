// Labelled copy button for each highlighted code block. It sits in the block's
// header bar, outside the scrolling pre, and announces the result.
{
  const copyIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.25" y="5.25" width="8" height="8" rx="1.75" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10.75 5.25V4A1.25 1.25 0 0 0 9.5 2.75h-5A1.75 1.75 0 0 0 2.75 4.5v5A1.25 1.25 0 0 0 4 10.75h1.25" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  const doneIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const blocks = document.querySelectorAll('.td-content .highlight');
  let status;
  if (blocks.length) {
    status = document.createElement('span');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    document.body.append(status);
  }
  for (const block of blocks) {
    const code = block.querySelector('pre code') || block.querySelector('pre');
    if (!code) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mx-copy';
    button.innerHTML = copyIcon + '<span>Copy</span>';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    let timer;
    button.addEventListener('click', async () => {
      let ok = true;
      const text = code.innerText.replace(/\n$/, '');
    try { await navigator.clipboard.writeText(text); } catch (_) {
      // Clipboard API is unavailable on insecure origins and some embeds.
      const area = Object.assign(document.createElement('textarea'), { value: text });
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      area.remove();
      button.focus();
    }
      button.classList.toggle('is-copied', ok);
      button.innerHTML = (ok ? doneIcon : copyIcon) + `<span>${ok ? 'Copied' : 'Copy failed'}</span>`;
      status.textContent = '';
      status.textContent = ok ? 'Code copied to clipboard' : 'Copy failed';
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.classList.remove('is-copied');
        button.innerHTML = copyIcon + '<span>Copy</span>';
      }, 1800);
    });
    block.append(button);
  }
}

// Page header "Copy link" action: copies the canonical page URL (without query).
for (const button of document.querySelectorAll('[data-mx-copy-link]')) {
  button.addEventListener('click', async () => {
    const label = button.querySelector('[data-mx-copy-label]');
    const url = window.location.origin + window.location.pathname + window.location.hash;
    try {
      await navigator.clipboard.writeText(url);
      label.textContent = 'Copied';
    } catch (_) {
      label.textContent = 'Copy failed';
    }
    setTimeout(() => { label.textContent = 'Copy link'; }, 1600);
  });
}
