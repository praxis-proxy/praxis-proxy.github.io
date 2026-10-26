/* Progressive enhancement: CSS owns motion; this file manages visibility and pointers. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let dispose = () => {};

  function initialize() {
    dispose();
    if (reduced.matches) return;
    const cleanups = [];
    const listen = (target, event, handler, options) => {
      target.addEventListener(event, handler, options);
      cleanups.push(() => target.removeEventListener(event, handler, options));
    };
    const scenes = [...document.querySelectorAll('[data-motion-scene]')];
    const onVisibility = () => {
      if (document.hidden) root.style.setProperty('--motion-play', 'paused');
      else root.style.removeProperty('--motion-play');
    };
    listen(document, 'visibilitychange', onVisibility);
    onVisibility();

    if ('IntersectionObserver' in window) {
      const visibility = new IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => {
          target.style.setProperty('--scene-play', isIntersecting ? 'running' : 'paused');
        });
      });
      scenes.forEach(scene => visibility.observe(scene));
      cleanups.push(() => visibility.disconnect());

      const entrances = document.querySelectorAll(
        '.home-section__heading, .task-card, .gateway-spotlight__copy, ' +
        '.gateway-spotlight__protocols, .project-spotlight__copy, .project-spotlight__visual, ' +
        '.docs-directory-card, .community-card, .product-journey-group, .praxis-blog-card'
      );
      const seen = new WeakSet();
      const reveal = new IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting || seen.has(target)) return;
          seen.add(target);
          // Apply only as content approaches the viewport. Never pre-hide content.
          const siblings = [...target.parentElement.children];
          target.style.setProperty('--enter-delay', `${Math.min(siblings.indexOf(target), 3) * 65}ms`);
          target.classList.add('motion-enter');
          reveal.unobserve(target);
        });
      }, { rootMargin: '0px 0px 40px 0px', threshold: 0 });
      entrances.forEach(element => reveal.observe(element));
      listen(document, 'animationend', event => {
        if (event.animationName === 'praxis-enter') event.target.classList.remove('motion-enter');
      });
      cleanups.push(() => {
        reveal.disconnect();
        entrances.forEach(element => {
          element.classList.remove('motion-enter');
          element.style.removeProperty('--enter-delay');
        });
      });
    }

    const progress = document.createElement('div');
    progress.className = 'page-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.append(progress);
    let scrollFrame = 0;
    function updateProgress() {
      scrollFrame = 0;
      const extent = root.scrollHeight - window.innerHeight;
      const amount = extent > 0 ? Math.max(0, Math.min(1, window.scrollY / extent)) : 0;
      progress.style.setProperty('--reading-progress', amount);
    }
    function queueProgress() {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
    }
    listen(window, 'scroll', queueProgress, { passive: true });
    listen(window, 'resize', queueProgress, { passive: true });
    updateProgress();
    cleanups.push(() => { cancelAnimationFrame(scrollFrame); progress.remove(); });

    if (finePointer.matches) {
      const surfaces = document.querySelectorAll(
        '[data-motion-tilt], .task-card, .gateway-spotlight__protocols, .project-spotlight__visual, .docs-directory-card'
      );
      surfaces.forEach(surface => {
        const tilt = surface.hasAttribute('data-motion-tilt');
        if (!tilt) surface.classList.add('motion-surface');
        let frame = 0;
        let x = 0;
        let y = 0;
        function paint() {
          frame = 0;
          const bounds = surface.getBoundingClientRect();
          if (!bounds.width || !bounds.height) return;
          const px = Math.max(0, Math.min(1, (x - bounds.left) / bounds.width));
          const py = Math.max(0, Math.min(1, (y - bounds.top) / bounds.height));
          if (tilt) {
            surface.style.setProperty('--tilt-x', `${(0.5 - py) * 5}deg`);
            surface.style.setProperty('--tilt-y', `${(px - 0.5) * 6}deg`);
          } else {
            surface.style.setProperty('--light-x', `${px * 100}%`);
            surface.style.setProperty('--light-y', `${py * 100}%`);
          }
        }
        function reset() {
          cancelAnimationFrame(frame);
          frame = 0;
          ['--tilt-x', '--tilt-y', '--light-x', '--light-y'].forEach(name => surface.style.removeProperty(name));
        }
        listen(surface, 'pointermove', event => {
          if (event.pointerType === 'touch') return;
          x = event.clientX;
          y = event.clientY;
          if (!frame) frame = requestAnimationFrame(paint);
        }, { passive: true });
        listen(surface, 'pointerleave', reset);
        listen(surface, 'pointercancel', reset);
        cleanups.push(() => { reset(); surface.classList.remove('motion-surface'); });
      });
    }
    dispose = () => {
      cleanups.forEach(cleanup => cleanup());
      root.style.removeProperty('--motion-play');
      scenes.forEach(scene => scene.style.removeProperty('--scene-play'));
    };
  }

  reduced.addEventListener('change', initialize);
  finePointer.addEventListener('change', initialize);
  initialize();
})();
