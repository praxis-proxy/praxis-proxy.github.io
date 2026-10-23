(() => {
  const button = document.querySelector('#praxis-theme-toggle');
  if (!button) return;

  const root = document.documentElement;
  const syncLabel = () => {
    const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    const label = `Switch to ${next} mode`;
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  button.addEventListener('click', () => {
    const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('td-color-theme', next); } catch (_) {}
    root.setAttribute('data-bs-theme', next);
  });
  new MutationObserver(syncLabel).observe(root, { attributes: true, attributeFilter: ['data-bs-theme'] });
  syncLabel();
  button.disabled = false;
})();
