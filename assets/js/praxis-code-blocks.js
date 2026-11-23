// Docsy creates the copy control inside the scrolling pre. Move it beside the
// pre so one-line blocks stay compact and long lines cannot run beneath it.
for (const control of document.querySelectorAll('.td-content .highlight > pre > .click-to-copy')) {
  control.parentElement.parentElement.append(control);
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
