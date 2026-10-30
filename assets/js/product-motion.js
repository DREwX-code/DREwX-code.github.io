(() => {
  'use strict';

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = [
    ['.premium-visual', 'premium'],
    ['.chat-visual', 'omni'],
    ['.translator-visual', 'translator']
  ];
  const running = new Map();
  const themeSessions = new Map();
  const easing = 'cubic-bezier(.22,.75,.22,1)';

  function position(element, frame) {
    let x = element.offsetWidth / 2;
    let y = element.offsetHeight / 2;
    let node = element;
    while (node && node !== frame) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    if (node === frame) return { x, y };
    const a = element.getBoundingClientRect();
    const b = frame.getBoundingClientRect();
    return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
  }

  function start(card, visual, kind) {
    stop(card);
    if (!canHover.matches || reduced.matches || card.classList.contains('has-utst-interaction') || (kind === 'omni' && !visual.querySelector('.omni-manual-view')?.hidden)) return;
    const frame = visual.querySelector('.product-frame');
    const cursor = frame?.querySelector('.product-cursor');
    if (!frame || !cursor) return;
    cursor.style.left = '0px';
    cursor.style.top = '0px';
    cursor.style.right = 'auto';
    const frameRect = frame.getBoundingClientRect();
    const visualRect = visual.getBoundingClientRect();
    const center = { x: visualRect.width / 2 - (frameRect.left - visualRect.left), y: visualRect.height / 2 - (frameRect.top - visualRect.top) };
    const zoom = (point, scale) => {
      let x = center.x - point.x * scale;
      let y = center.y - point.y * scale;
      if (kind === 'premium') {
        // Keep the enlarged browser covering the showcase instead of exposing its edge.
        const left = visualRect.left - frameRect.left;
        const top = visualRect.top - frameRect.top;
        x = Math.min(left, Math.max(left + visualRect.width - frameRect.width * scale, x));
        y = Math.min(top, Math.max(top + visualRect.height - frameRect.height * scale, y));
      }
      return `translate(${x}px, ${y}px) scale(${scale})`;
    };
    const cursorAt = (point, scale = 1) => `translate(${point.x - 4}px, ${point.y - 2}px) scale(${scale})`;
    const inFrame = (selector) => position(frame.querySelector(selector), frame);
    const animations = [];
    const duration = kind === 'omni' ? 18000 : kind === 'premium' ? 18000 : 11500;
    const animate = (element, frames) => {
      if (!element) return null;
      const animation = element.animate(frames, { duration, fill: 'both', easing: 'linear' });
      animations.push(animation);
      return animation;
    };
    const at = (offset, value) => ({ offset, easing, ...value });
    const home = 'translate(0px, 0px) scale(1)';
    const caption = (key, from, to) => {
      const element = visual.querySelector(`[data-motion-caption="${key}"]`);
      animate(element, [at(0,{opacity:0}), at(from,{opacity:0}), at(from + .025,{opacity:1}), at(to - .025,{opacity:1}), at(to,{opacity:0}), at(1,{opacity:0})]);
    };

    if (kind === 'omni') {
      const button = inFrame('.omni-export-button');
      const option = inFrame('.omni-format-menu--header [data-export-format="pdf"]');
      const menu = inFrame('.omni-format-menu--header');
      const download = inFrame('.omni-download-card');
      const near = { x: button.x - 55, y: button.y + 45 };
      caption('motionExport', .01, .49);
      caption('motionPdf', .78, .99);
      animate(frame, [at(0,{transform:home}), at(.15,{transform:home}), at(.25,{transform:zoom(menu, 1.9)}), at(.43,{transform:zoom(menu, 1.9)}), at(.54,{transform:home}), at(1,{transform:home})]);
      animate(cursor, [at(0,{opacity:0,transform:cursorAt(near)}),at(.05,{opacity:1,transform:cursorAt(near)}),at(.12,{opacity:1,transform:cursorAt(button)}),at(.145,{opacity:1,transform:cursorAt(button,.82)}),at(.16,{opacity:1,transform:cursorAt(button)}),at(.30,{opacity:1,transform:cursorAt(button)}),at(.37,{opacity:1,transform:cursorAt(option)}),at(.40,{opacity:1,transform:cursorAt(option,.82)}),at(.43,{opacity:1,transform:cursorAt(option)}),at(.60,{opacity:1,transform:cursorAt(option)}),at(.70,{opacity:1,transform:cursorAt(download)}),at(.73,{opacity:1,transform:cursorAt(download,.82)}),at(.76,{opacity:0,transform:cursorAt(download)}),at(1,{opacity:0,transform:cursorAt(download)})]);
      animate(frame.querySelector('.omni-format-menu--header'),[at(0,{opacity:0,transform:'translateY(-4px)'}),at(.15,{opacity:0,transform:'translateY(-4px)'}),at(.19,{opacity:1,transform:'none'}),at(.43,{opacity:1,transform:'none'}),at(.48,{opacity:0,transform:'translateY(-4px)'}),at(1,{opacity:0,transform:'translateY(-4px)'})]);
      animate(frame.querySelector('.omni-format-menu--header [data-export-format="pdf"]'),[at(0,{backgroundColor:'transparent'}),at(.37,{backgroundColor:'transparent'}),at(.40,{backgroundColor:'rgba(148,163,184,.22)'}),at(.46,{backgroundColor:'rgba(148,163,184,.22)'}),at(.48,{backgroundColor:'transparent'}),at(1,{backgroundColor:'transparent'})]);
      animate(frame.querySelector('.omni-download-card'),[at(0,{opacity:0}),at(.53,{opacity:0}),at(.57,{opacity:1}),at(.76,{opacity:1}),at(.79,{opacity:0}),at(1,{opacity:0})]);
      animate(frame.querySelector('.omni-download-bar'),[at(0,{transform:'scaleX(0)'}),at(.56,{transform:'scaleX(0)'}),at(.68,{transform:'scaleX(1)'}),at(1,{transform:'scaleX(1)'})]);
      animate(frame.querySelector('.omni-pdf-view'),[at(0,{opacity:0}),at(.75,{opacity:0}),at(.80,{opacity:1}),at(1,{opacity:1})]);
      const paper = frame.querySelector('.omni-pdf-paper');
      const viewport = frame.querySelector('.omni-pdf-scroll');
      const scrollDistance = Math.max(0, paper.offsetHeight + 12 - viewport.clientHeight);
      const paperMotion = animate(paper,[at(0,{transform:'translateY(0px)'}),at(.82,{transform:'translateY(0px)'}),at(.98,{transform:`translateY(${-scrollDistance}px)`}),at(1,{transform:`translateY(${-scrollDistance}px)`})]);
      paperMotion.onfinish = () => {
        if (!running.has(card)) return;
        paperMotion.cancel();
        viewport.scrollTop = scrollDistance;
        const view = frame.querySelector('.omni-pdf-view');
        view.classList.add('is-browsable');
        view.removeAttribute('aria-hidden');
        viewport.tabIndex = 0;
      };
    } else if (kind === 'premium') {
      const note = inFrame('.gf-primary-row .gf-note-button');
      const done = inFrame('.gf-primary-row [data-demo-action="gf-note-done"]');
      const star = inFrame('.gf-primary-row .gf-star-button');
      const field = inFrame('.gf-typed-note');
      const appearance = inFrame('.gf-variant-menu');
      const plus = inFrame('.gf-variant-toggle');
      const chalkboard = inFrame('[data-demo-variant="chalkboard"]');
      const near = { x: note.x - 55, y: note.y + 55 };
      caption('motionNotes', .015, .35);
      caption('motionFavorites', .36, .53);
      caption('motionThemes', .53, .98);
      animate(frame,[at(0,{transform:home}),at(.10,{transform:home}),at(.16,{transform:zoom(field,2.1)}),at(.30,{transform:zoom(field,2.1)}),at(.35,{transform:home}),at(.54,{transform:home}),at(.60,{transform:zoom(appearance,1.65)}),at(.68,{transform:zoom(appearance,1.65)}),at(.76,{transform:home}),at(1,{transform:home})]);
      animate(cursor,[at(0,{opacity:0,transform:cursorAt(near)}),at(.025,{opacity:1,transform:cursorAt(near)}),at(.07,{opacity:1,transform:cursorAt(note)}),at(.09,{opacity:1,transform:cursorAt(note,.8)}),at(.11,{opacity:1,transform:cursorAt(note)}),at(.23,{opacity:1,transform:cursorAt(note)}),at(.27,{opacity:1,transform:cursorAt(done)}),at(.285,{opacity:1,transform:cursorAt(done,.8)}),at(.305,{opacity:1,transform:cursorAt(done)}),at(.40,{opacity:1,transform:cursorAt(star)}),at(.415,{opacity:1,transform:cursorAt(star,.8)}),at(.44,{opacity:1,transform:cursorAt(star)}),at(.54,{opacity:1,transform:cursorAt(plus)}),at(.56,{opacity:1,transform:cursorAt(plus,.8)}),at(.58,{opacity:1,transform:cursorAt(plus)}),at(.64,{opacity:1,transform:cursorAt(chalkboard)}),at(.66,{opacity:1,transform:cursorAt(chalkboard,.8)}),at(.70,{opacity:1,transform:cursorAt(chalkboard)}),at(.76,{opacity:0,transform:cursorAt(chalkboard)}),at(1,{opacity:0,transform:cursorAt(chalkboard)})]);
      animate(frame.querySelector('.gf-note-panel'),[at(0,{maxHeight:'0px',opacity:0}),at(.09,{maxHeight:'0px',opacity:0}),at(.14,{maxHeight:'43px',opacity:1}),at(.285,{maxHeight:'43px',opacity:1}),at(.32,{maxHeight:'0px',opacity:0}),at(1,{maxHeight:'0px',opacity:0})]);
      animate(frame.querySelector('.gf-typed-note'),[at(0,{clipPath:'inset(0 100% 0 0)'}),at(.17,{clipPath:'inset(0 100% 0 0)'}),at(.235,{clipPath:'inset(0 0 0 0)'}),at(1,{clipPath:'inset(0 0 0 0)'})]);
      animate(frame.querySelector('.gf-primary-row .gf-star-button svg'),[at(0,{fill:'transparent',color:'inherit'}),at(.40,{fill:'transparent',color:'inherit'}),at(.42,{fill:'rgba(244,180,0,.35)',color:'#f4b400'}),at(1,{fill:'rgba(244,180,0,.35)',color:'#f4b400'})]);
      animate(frame.querySelector('.gf-variant-menu'),[at(0,{opacity:0}),at(.56,{opacity:0}),at(.58,{opacity:1}),at(.66,{opacity:1}),at(.69,{opacity:0}),at(1,{opacity:0})]);
      if (frame.querySelector('.gf-note-preview')?.hidden) animate(frame.querySelector('.gf-demo-note-preview'), [at(0,{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',marginTop:'0px'}),at(.31,{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',marginTop:'0px'}),at(.35,{height:'auto',opacity:1,paddingTop:'6px',paddingBottom:'6px',marginTop:'7px'}),at(1,{height:'auto',opacity:1,paddingTop:'6px',paddingBottom:'6px',marginTop:'7px'})]);
      // Drive the same theme state used by the actual demo controls.
      const app = frame.querySelector('.premium-app');
      const originalTheme = app.dataset.demoTheme;
      const originalVariant = app.dataset.demoVariant;
      const originalMode = frame.querySelector('[data-demo-theme-value].is-active')?.dataset.demoThemeValue || 'system';
      const favoriteRow = frame.querySelector('.gf-primary-row');
      const originalFavorite = favoriteRow.classList.contains('has-favorite');
      const applyTheme = (theme, variant, mode) => {
        app.dataset.demoTheme = theme;
        app.dataset.demoVariant = variant;
        frame.querySelectorAll('[data-demo-theme-value]').forEach(button => button.classList.toggle('is-active', button.dataset.demoThemeValue === mode));
        frame.querySelectorAll('.gf-variant-menu [data-demo-variant]').forEach(button => {
          const selected = button.dataset.demoVariant === variant;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
      };
      const clock = animate(frame.querySelector('.gf-density-demo'), [at(0,{opacity:1}), at(1,{opacity:1})]);
      const session = { frameId: 0, restore: () => { applyTheme(originalTheme, originalVariant, originalMode); favoriteRow.classList.toggle('has-favorite', originalFavorite); } };
      themeSessions.set(card, session);
      const syncTheme = () => {
        if (themeSessions.get(card) !== session) return;
        const progress = Math.max(0, Math.min(1, Number(clock.currentTime || 0) / duration));
        favoriteRow.classList.toggle('has-favorite', progress >= .42 || originalFavorite);
        if (progress >= .66) applyTheme(originalTheme, 'chalkboard', originalMode);
        else applyTheme(originalTheme, originalVariant, originalMode);
        if (progress < 1) session.frameId = requestAnimationFrame(syncTheme);
      };
      session.frameId = requestAnimationFrame(syncTheme);
    } else {
      const mark = inFrame('.reader-page mark');
      const bubble = inFrame('.utst-bubble-action');
      const panel = inFrame('.translator-popover');
      const markWidth = frame.querySelector('mark').offsetWidth;
      const markStart = { x: mark.x - markWidth / 2, y: mark.y };
      const markEnd = { x: mark.x + markWidth / 2, y: mark.y };
      const near = { x: markStart.x - 25, y: markStart.y + 25 };
      caption('motionSelect', .01, .30);
      caption('motionTranslate', .34, .98);
      animate(frame,[at(0,{transform:home}),at(.30,{transform:home}),at(.43,{transform:zoom(panel,1.65)}),at(.69,{transform:zoom(panel,1.65)}),at(.82,{transform:home}),at(1,{transform:home})]);
      animate(cursor,[at(0,{opacity:0,transform:cursorAt(near)}),at(.17,{opacity:0,transform:cursorAt(markEnd)}),at(.19,{opacity:1,transform:cursorAt(markEnd)}),at(.23,{opacity:1,transform:cursorAt(bubble)}),at(.26,{opacity:1,transform:cursorAt(bubble,.8)}),at(.30,{opacity:1,transform:cursorAt(bubble)}),at(.39,{opacity:0,transform:cursorAt(bubble)}),at(1,{opacity:0,transform:cursorAt(bubble)})]);
      animate(frame.querySelector('.utst-text-cursor'),[at(0,{opacity:0,transform:cursorAt(near)}),at(.04,{opacity:1,transform:cursorAt(near)}),at(.08,{opacity:1,transform:cursorAt(markStart)}),at(.16,{opacity:1,transform:cursorAt(markEnd)}),at(.18,{opacity:0,transform:cursorAt(markEnd)}),at(1,{opacity:0,transform:cursorAt(markEnd)})]);
      animate(frame.querySelector('mark'),[at(0,{backgroundSize:'0% 100%'}),at(.08,{backgroundSize:'0% 100%'}),at(.16,{backgroundSize:'100% 100%'}),at(1,{backgroundSize:'100% 100%'})]);
      animate(frame.querySelector('.utst-selection-bubble'),[at(0,{opacity:0,transform:'translateY(4px)'}),at(.16,{opacity:0,transform:'translateY(4px)'}),at(.20,{opacity:1,transform:'none'}),at(.27,{opacity:1,transform:'none'}),at(.33,{opacity:0,transform:'translateY(-4px)'}),at(1,{opacity:0,transform:'translateY(-4px)'})]);
      animate(frame.querySelector('.translator-popover'),[at(0,{opacity:0,transform:'translateY(8px) scale(.98)'}),at(.29,{opacity:0,transform:'translateY(8px) scale(.98)'}),at(.37,{opacity:1,transform:'none'}),at(1,{opacity:1,transform:'none'})]);
    }
    running.set(card, animations);
  }

  function stop(card) {
    const pdfView = card.querySelector('.omni-pdf-view');
    if (pdfView) {
      pdfView.classList.remove('is-browsable');
      pdfView.setAttribute('aria-hidden', 'true');
      const viewport = pdfView.querySelector('.omni-pdf-scroll');
      viewport.tabIndex = -1;
      viewport.scrollTop = 0;
    }
    const session = themeSessions.get(card);
    if (session) { cancelAnimationFrame(session.frameId); themeSessions.delete(card); session.restore(); }
    (running.get(card) || []).forEach((animation) => animation.cancel());
    running.delete(card);
  }

  scenes.forEach(([selector, kind]) => {
    const visual = document.querySelector(selector);
    const card = visual?.closest('.feature-card');
    if (!card) return;
    card.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') start(card, visual, kind); });
    card.addEventListener('pointerleave', () => stop(card));
    card.addEventListener('pointerdown', (event) => { if (event.target.closest('[data-demo-action]') || (kind === 'translator' && event.target.closest('.reader-page'))) stop(card); });
  });
  const statsLayout = document.querySelector('.stats-layouts');
  let statsTimer = 0;
  let statsVisible = false;
  function updateStatsCycle() {
    window.clearInterval(statsTimer);
    statsTimer = 0;
    if (!statsLayout) return;
    statsLayout.dataset.layout = 'grid';
    if (statsVisible && !reduced.matches) {
      statsTimer = window.setInterval(() => {
        statsLayout.dataset.layout = statsLayout.dataset.layout === 'grid' ? 'compact' : 'grid';
      }, 5000);
    }
  }
  if (statsLayout && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const next = entries[0].isIntersecting && entries[0].intersectionRatio >= .25;
      if (next !== statsVisible) { statsVisible = next; updateStatsCycle(); }
    }, { threshold: [.0, .25] });
    observer.observe(statsLayout.closest('.stats-visual'));
  }
  reduced.addEventListener?.('change', () => {
    if (reduced.matches) running.forEach((_, card) => stop(card));
    updateStatsCycle();
  });
})();
