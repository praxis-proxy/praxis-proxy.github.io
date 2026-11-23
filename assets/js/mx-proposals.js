/* Proposals list: client-side filtering over server-rendered, fully visible cards. */
(() => {
  'use strict';
  const bar = document.querySelector('[data-mx-filters]');
  if (!bar) return;
  const q = bar.querySelector('[data-mx-q]');
  const count = bar.querySelector('[data-mx-count]');
  const empty = document.querySelector('[data-mx-empty]');
  const groups = [...document.querySelectorAll('[data-mx-group]')];
  const cards = [...document.querySelectorAll('.mx-props__grid [data-status]')];
  const state = { status: '', repo: '', text: '' };

  const pick = (attr, value) => {
    bar.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  };
  const apply = () => {
    const words = state.text.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    cards.forEach(card => {
      const ok = (!state.status || card.dataset.status === state.status)
        && (!state.repo || card.dataset.repos.split(' ').includes(state.repo))
        && words.every(w => card.dataset.text.includes(w.replace(/^#/, '')));
      card.hidden = !ok;
      if (ok) shown++;
    });
    groups.forEach(g => { g.hidden = !g.querySelector('[data-status]:not([hidden])'); });
    empty.hidden = shown > 0;
    const filtered = state.status || state.repo || words.length;
    count.textContent = filtered ? `${shown} of ${cards.length} proposals` : `${cards.length} proposals`;
  };

  bar.addEventListener('click', event => {
    const b = event.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-mx-status')) { state.status = b.dataset.mxStatus; pick('data-mx-status', state.status); }
    if (b.hasAttribute('data-mx-repo')) { state.repo = b.dataset.mxRepo; pick('data-mx-repo', state.repo); }
    apply();
  });
  q.addEventListener('input', () => { state.text = q.value; apply(); });
  empty.querySelector('[data-mx-reset]').addEventListener('click', () => {
    Object.assign(state, { status: '', repo: '', text: '' });
    q.value = '';
    pick('data-mx-status', '');
    pick('data-mx-repo', '');
    apply();
    q.focus();
  });
  bar.hidden = false;
  apply();
})();
