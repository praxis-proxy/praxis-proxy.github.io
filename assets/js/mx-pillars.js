/* Landing capability tabs: progressive enhancement over stacked panels. */
(() => {
  'use strict';
  const root = document.querySelector('[data-mx-pillars]');
  if (!root) return;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  const pause = root.querySelector('[data-mx-pause]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let auto = !reduced.matches;

  const select = (index, focus) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
    });
    if (focus) tabs[index].focus();
  };
  const stopAuto = () => { auto = false; root.classList.remove('is-auto'); };
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => { stopAuto(); select(i); });
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key in keys) next = (i + keys[event.key] + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      stopAuto();
      select(next, true);
    });
    tab.querySelector('.mx-pillars__bar').addEventListener('animationend', () => {
      if (auto) select((i + 1) % tabs.length);
    });
  });

  pause.addEventListener('click', () => {
    const paused = pause.getAttribute('aria-pressed') !== 'true';
    pause.setAttribute('aria-pressed', String(paused));
    pause.lastElementChild.textContent = paused ? 'Play animations' : 'Pause animations';
    root.classList.toggle('is-paused', paused);
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => root.classList.toggle('is-offscreen', !entry.isIntersecting)).observe(root);
  }
  root.classList.add('is-ready');
  if (auto) root.classList.add('is-auto');
  select(0);
})();
