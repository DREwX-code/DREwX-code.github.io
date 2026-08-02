(() => {
  'use strict';

  const root = document.documentElement;
  const dictionary = window.DREWX_I18N;
  const pageName = document.body.dataset.page || 'home';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* Preferences remain session-only. */ }
    }
  };

  const greasyForkStats = {
    cacheKey: 'drewx-greasyfork-stats-v1',
    cacheDuration: 60 * 60 * 1000,
    endpoint: 'https://greasyfork.org/en/users/1259433.json'
  };

  const formatCompactNumber = (value) => {
    if (!Number.isFinite(value)) return '';
    if (value < 1000) return String(value);
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  };

  const applyGreasyForkStats = (payload) => {
    const scripts = payload?.scripts?.filter((script) => !script.deleted) || [];
    if (!scripts.length) return;

    const scriptsById = new Map(scripts.map((script) => [String(script.id), script]));
    document.querySelectorAll('[data-gf-script-id]').forEach((row) => {
      const script = scriptsById.get(row.dataset.gfScriptId);
      if (!script) return;

      const ratings = Number(script.good_ratings) + Number(script.ok_ratings) + Number(script.bad_ratings);
      const values = {
        daily_installs: `Daily installs ${script.daily_installs}`,
        total_installs: `Total installs ${formatCompactNumber(Number(script.total_installs))}`,
        ratings: `Ratings ${ratings}`
      };
      row.querySelectorAll('[data-gf-stat]').forEach((element) => {
        const value = values[element.dataset.gfStat];
        if (value) element.textContent = value;
        if (element.dataset.gfStat === 'ratings' && script.fan_score) {
          element.title = `Fan score ${script.fan_score}%`;
        }
      });
    });

    const totalInstalls = scripts.reduce((total, script) => total + Number(script.total_installs || 0), 0);
    const totalElement = document.querySelector('[data-gf-total-installs]');
    const countElement = document.querySelector('[data-gf-script-count]');
    if (totalElement) totalElement.textContent = `${formatCompactNumber(totalInstalls)}+`;
    if (countElement) countElement.textContent = String(scripts.length);
  };

  const updateGreasyForkStats = async () => {
    let cached = null;
    try { cached = JSON.parse(storage.get(greasyForkStats.cacheKey)); } catch { /* Ignore an invalid cache. */ }
    if (cached?.data) applyGreasyForkStats(cached.data);
    if (cached?.savedAt && Date.now() - cached.savedAt < greasyForkStats.cacheDuration) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(greasyForkStats.endpoint, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Greasy Fork returned ${response.status}`);
      const data = await response.json();
      applyGreasyForkStats(data);
      storage.set(greasyForkStats.cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
    } catch { /* Keep the cached or static fallback values. */ }
    finally { window.clearTimeout(timeout); }
  };

  let currentLanguage = storage.get('drewx-language')
    || (navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en');

  const themeButton = document.querySelector('[data-theme-toggle]');
  const languageButtons = document.querySelectorAll('[data-language]');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobilePanel = document.querySelector('[data-mobile-panel]');
  const header = document.querySelector('[data-header]');
  const progressBar = document.querySelector('[data-scroll-progress]');
  const projectCards = document.querySelectorAll('[data-category]');
  const filterButtons = document.querySelectorAll('[data-filter]');
  const directoryCount = document.querySelector('[data-project-count]');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let activeFilter = 'all';
  let scrollFrame = 0;
  let resizeFrame = 0;
  let menuOpen = false;
  let headerGeometry = { headerHeight: 0, viewportWidth: 0 };
  let lastHeaderPosition = { headerTop: null, compact: null };

  const languageSpacer = document.createElement('div');
  languageSpacer.className = 'language-layout-spacer';
  languageSpacer.setAttribute('aria-hidden', 'true');
  document.body.append(languageSpacer);

  const captureViewport = () => {
    if (!root.classList.contains('ready') || window.scrollY < 2) return null;
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const sampleY = Math.min(window.innerHeight - 1, Math.max(headerBottom + 24, window.innerHeight * .34));
    const sampled = document.elementFromPoint(window.innerWidth / 2, sampleY)
      || document.elementFromPoint(window.innerWidth * .25, sampleY);
    const anchor = sampled?.closest('[data-i18n], [data-i18n-html], article, section, main') || sampled;
    if (!anchor || anchor === languageSpacer) return null;
    return {
      anchor,
      anchorDocumentTop: anchor.getBoundingClientRect().top + window.scrollY,
      documentHeight: document.documentElement.scrollHeight,
      scrollY: window.scrollY
    };
  };

  const restoreViewport = (state) => {
    if (!state || !state.anchor.isConnected) {
      languageSpacer.style.height = '0px';
      return;
    }

    const newAnchorDocumentTop = state.anchor.getBoundingClientRect().top + window.scrollY;
    const desiredScroll = Math.max(0, state.scrollY + newAnchorDocumentTop - state.anchorDocumentTop);
    languageSpacer.style.height = '0px';
    const naturalHeight = document.documentElement.scrollHeight;
    const requiredSpace = Math.max(0, desiredScroll + window.innerHeight - naturalHeight);
    languageSpacer.style.height = `${Math.ceil(requiredSpace)}px`;
    window.scrollTo(0, desiredScroll);
  };

  const translatePage = (language) => {
    const copy = dictionary[language];
    if (!copy) return;

    const viewportState = captureViewport();
    if (viewportState) languageSpacer.style.height = `${viewportState.documentHeight}px`;

    currentLanguage = language;
    root.lang = language;

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = copy[element.dataset.i18n];
      if (value !== undefined) element.textContent = value;
    });

    document.querySelectorAll('[data-i18n-html]').forEach((element) => {
      const value = copy[element.dataset.i18nHtml];
      if (value !== undefined) element.innerHTML = value;
    });

    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      const value = copy[element.dataset.i18nAria];
      if (value !== undefined) element.setAttribute('aria-label', value);
    });

    document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
      const value = copy[element.dataset.i18nAlt];
      if (value !== undefined) element.setAttribute('alt', value);
    });

    languageButtons.forEach((button) => {
      const active = button.dataset.language === language;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    const meta = copy.meta;
    document.title = pageName === 'projects' ? meta.projectsTitle : meta.homeTitle;
    const description = pageName === 'projects' ? meta.projectsDescription : meta.homeDescription;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (descriptionMeta) descriptionMeta.content = description;
    if (ogDescription) ogDescription.content = description;
    if (ogTitle) ogTitle.content = document.title;

    storage.set('drewx-language', language);
    updateThemeLabel();
    updateMenuLabel();
    updateProjectCount();
    restoreViewport(viewportState);
  };

  const updateThemeLabel = () => {
    if (!themeButton || !dictionary[currentLanguage]) return;
    const key = root.dataset.theme === 'dark' ? 'themeToLight' : 'themeToDark';
    themeButton.setAttribute('aria-label', dictionary[currentLanguage][key]);
    themeButton.title = dictionary[currentLanguage][key];
  };

  const setTheme = (theme, persist = true) => {
    root.dataset.theme = theme;
    if (themeMeta) themeMeta.content = theme === 'dark' ? '#171715' : '#f5f1e8';
    document.querySelectorAll('.premium-theme-controls [data-demo-theme-value="system"].is-active').forEach((control) => {
      const premiumApp = control.closest('.premium-app');
      if (premiumApp) premiumApp.dataset.demoTheme = theme;
    });
    if (persist) storage.set('drewx-theme', theme);
    updateThemeLabel();
  };

  const updateMenuLabel = () => {
    if (!menuButton || !dictionary[currentLanguage]) return;
    const key = menuOpen ? 'menuClose' : 'menuOpen';
    menuButton.setAttribute('aria-label', dictionary[currentLanguage][key]);
    menuButton.title = dictionary[currentLanguage][key];
  };

  const setMenu = (open) => {
    if (!menuButton || !mobilePanel) return;
    menuOpen = open;
    document.body.classList.toggle('menu-open', open);
    header?.classList.toggle('menu-visible', open);
    mobilePanel.classList.toggle('open', open);
    mobilePanel.setAttribute('aria-hidden', String(!open));
    mobilePanel.inert = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.classList.toggle('active', open);
    updateMenuLabel();
    updateHeaderGeometry();
  };

  const updateHeaderPosition = (_scrollTop = window.scrollY, force = false) => {
    if (!header) return;
    const { headerHeight, viewportWidth } = headerGeometry;
    const compact = header.classList.contains('scrolled') || menuOpen;
    const headerTop = compact ? 10 : 0;

    if (force || headerTop !== lastHeaderPosition.headerTop) {
      root.style.setProperty('--header-top', `${headerTop}px`);
      root.style.setProperty('--mobile-panel-top', `${headerTop + headerHeight}px`);
    }
    if (force || compact !== lastHeaderPosition.compact) {
      const headerWidth = compact ? Math.min(viewportWidth - 36, 1200) : viewportWidth;
      const headerLeft = Math.max(0, (viewportWidth - headerWidth) / 2);
      root.style.setProperty('--mobile-panel-left', `${headerLeft}px`);
      root.style.setProperty('--mobile-panel-width', `${headerWidth}px`);
    }

    lastHeaderPosition = { headerTop, compact };
  };

  const updateHeaderGeometry = () => {
    if (!header) return;
    headerGeometry = {
      headerHeight: header.offsetHeight,
      viewportWidth: document.documentElement.clientWidth
    };
    updateHeaderPosition(window.scrollY, true);
  };

  const updateTranslatorMotionPath = () => {
    document.querySelectorAll('.translator-frame').forEach((frame) => {
      const cursor = frame.querySelector('.translator-cursor');
      const copyButton = frame.querySelector('.utst-copy-button');
      const closeButton = frame.querySelector('.utst-close-button');
      const readerPage = frame.querySelector('.reader-page');
      const selectedText = readerPage?.querySelector('mark');
      const selectionBubble = readerPage?.querySelector('.utst-selection-bubble');
      const bubbleAction = selectionBubble?.querySelector('.utst-bubble-action');

      if (readerPage && selectedText && selectionBubble) {
        const pageBounds = readerPage.getBoundingClientRect();
        const selectionBounds = selectedText.getBoundingClientRect();
        const bubbleLeft = selectionBounds.left - pageBounds.left
          + (selectionBounds.width - selectionBubble.offsetWidth) / 2;
        const maxLeft = Math.max(8, readerPage.clientWidth - selectionBubble.offsetWidth - 8);
        selectionBubble.style.left = `${Math.min(maxLeft, Math.max(8, bubbleLeft))}px`;
        selectionBubble.style.top = `${selectionBounds.bottom - pageBounds.top + 7}px`;
      }

      if (!cursor || !copyButton || !closeButton || !bubbleAction) return;

      const getLayoutCenter = (element) => {
        let x = element.offsetWidth / 2;
        let y = element.offsetHeight / 2;
        let node = element;
        while (node && node !== frame) {
          x += node.offsetLeft;
          y += node.offsetTop;
          node = node.offsetParent;
        }
        if (node === frame) return { x, y };

        const frameBounds = frame.getBoundingClientRect();
        const bounds = element.getBoundingClientRect();
        return {
          x: bounds.left + bounds.width / 2 - frameBounds.left,
          y: bounds.top + bounds.height / 2 - frameBounds.top
        };
      };
      const bubbleTarget = getLayoutCenter(bubbleAction);
      cursor.style.left = `${bubbleTarget.x - cursor.offsetWidth * (5 / 24)}px`;
      cursor.style.top = `${bubbleTarget.y - cursor.offsetHeight * (3 / 24)}px`;
      const cursorHotspot = {
        x: cursor.offsetLeft + cursor.offsetWidth * (5 / 24),
        y: cursor.offsetTop + cursor.offsetHeight * (3 / 24)
      };
      const setTarget = (element, prefix) => {
        const target = getLayoutCenter(element);
        cursor.style.setProperty(`--utst-${prefix}-x`, `${target.x - cursorHotspot.x}px`);
        cursor.style.setProperty(`--utst-${prefix}-y`, `${target.y - cursorHotspot.y}px`);
      };
      setTarget(copyButton, 'copy');
      setTarget(closeButton, 'close');
    });
  };

  const updateProjectCount = () => {
    if (!directoryCount) return;
    const visible = Array.from(projectCards).filter((card) => !card.classList.contains('is-hidden')).length;
    directoryCount.textContent = currentLanguage === 'fr'
      ? `${visible} projet${visible > 1 ? 's' : ''}`
      : `${visible} project${visible > 1 ? 's' : ''}`;
  };

  const applyProjectFilter = (filter) => {
    activeFilter = filter;
    projectCards.forEach((card) => {
      const categories = card.dataset.category.split(' ');
      card.classList.toggle('is-hidden', filter !== 'all' && !categories.includes(filter));
    });
    filterButtons.forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateProjectCount();
  };

  languageButtons.forEach((button) => {
    button.addEventListener('click', () => translatePage(button.dataset.language));
  });

  document.querySelectorAll('.language-switch').forEach((languageSwitch) => {
    languageSwitch.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      const bounds = languageSwitch.getBoundingClientRect();
      translatePage(event.clientX < bounds.left + bounds.width / 2 ? 'fr' : 'en');
    });
  });

  themeButton?.addEventListener('click', () => {
    setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  systemTheme.addEventListener?.('change', (event) => {
    if (!storage.get('drewx-theme')) setTheme(event.matches ? 'dark' : 'light', false);
  });

  menuButton?.addEventListener('click', () => setMenu(!menuOpen));
  mobilePanel?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen) {
      setMenu(false);
      menuButton?.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (window.innerWidth > 760 && menuOpen) setMenu(false);
      updateHeaderGeometry();
      updateTranslatorMotionPath();
      resizeFrame = 0;
    });
  }, { passive: true });

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => applyProjectFilter(button.dataset.filter));
  });

  const cancelScroll = () => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  };

  const getAnchorDestination = (target, selector) => {
    if (selector === '#top') return 0;
    const landingTarget = target.querySelector?.('[data-anchor-focus]') || target;
    landingTarget.classList.add('visible');
    const headerOffset = header?.offsetHeight || 0;
    const restingGap = window.innerWidth <= 760 ? 24 : 34;
    let documentTop = 0;
    let offsetNode = landingTarget;
    while (offsetNode) {
      documentTop += offsetNode.offsetTop || 0;
      offsetNode = offsetNode.offsetParent;
    }
    const rawDestination = documentTop - headerOffset - restingGap;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(maxScroll, Math.max(0, rawDestination));
  };

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const selector = link.getAttribute('href');
      const target = selector === '#' ? null : document.querySelector(selector);
      if (!target) return;

      event.preventDefault();
      cancelScroll();
      const start = window.scrollY;
      const destination = getAnchorDestination(target, selector);
      const focusTarget = () => {
        if (link.classList.contains('skip-link')) target.focus({ preventScroll: true });
      };

      if (reducedMotion) {
        window.scrollTo(0, destination);
        focusTarget();
      } else {
        const distance = destination - start;
        const duration = Math.min(660, Math.max(320, Math.abs(distance) * .16));
        const startedAt = performance.now();
        const animate = (now) => {
          const progress = Math.min((now - startedAt) / duration, 1);
          const eased = progress < .5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          window.scrollTo(0, start + distance * eased);
          if (progress < 1) scrollFrame = requestAnimationFrame(animate);
          else {
            scrollFrame = 0;
            focusTarget();
          }
        };
        scrollFrame = requestAnimationFrame(animate);
      }

      if (location.hash !== selector) history.pushState(null, '', selector);
      setMenu(false);
    });
  });

  window.addEventListener('wheel', cancelScroll, { passive: true });
  window.addEventListener('touchstart', cancelScroll, { passive: true });

  const sectionLinks = Array.from(document.querySelectorAll('a[href="#work"], a[href="#approach"], a[href="#about"]'));
  const trackedSections = ['work', 'approach', 'about']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const updateActiveSection = () => {
    const threshold = (headerGeometry.headerHeight || 0) + (window.innerWidth <= 760 ? 34 : 58);
    let activeId = '';
    trackedSections.forEach((section) => {
      const focus = section.querySelector('[data-anchor-focus]') || section;
      if (focus.getBoundingClientRect().top <= threshold) activeId = section.id;
    });
    sectionLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${activeId}`;
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  let scrollTicking = false;
  const updateScrollUI = () => {
    const scrollTop = window.scrollY;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    updateActiveSection();
    if (header) {
      const isCompact = header.classList.contains('scrolled');
      const shouldCompact = isCompact ? scrollTop > 7 : scrollTop > 24;
      header.classList.toggle('scrolled', shouldCompact);
    }
    updateHeaderPosition(scrollTop);
    if (progressBar) progressBar.style.transform = `scaleX(${scrollable > 0 ? scrollTop / scrollable : 0})`;
    scrollTicking = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(updateScrollUI);
      scrollTicking = true;
    }
  }, { passive: true });

  document.querySelectorAll('[data-delay]').forEach((element) => {
    element.style.setProperty('--delay', `${element.dataset.delay}ms`);
  });

  if (!reducedMotion && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .06, rootMargin: '0px' });
    document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
  }

  const resetProductDemo = (card) => {
    card.classList.remove('has-manual-state');
    card.querySelectorAll('.is-installed, .is-favorite, .is-expanded, .is-open, .is-active, .is-copied, .is-restarting, .is-pressed, .is-selected')
      .forEach((element) => element.classList.remove('is-installed', 'is-favorite', 'is-expanded', 'is-open', 'is-active', 'is-copied', 'is-restarting', 'is-pressed', 'is-selected'));
    card.querySelectorAll('.has-favorite, .is-manual-open, .is-manual-closed, .is-manual-downloaded')
      .forEach((element) => element.classList.remove('has-favorite', 'is-manual-open', 'is-manual-closed', 'is-manual-downloaded'));
    card.querySelectorAll('.gf-install-button span').forEach((label) => { label.textContent = 'Install'; });
    const systemThemeControl = card.querySelector('.premium-theme-controls button:nth-child(2)');
    systemThemeControl?.classList.add('is-active');
    const premiumApp = card.querySelector('.premium-app');
    if (premiumApp) premiumApp.dataset.demoTheme = root.dataset.theme === 'light' ? 'light' : 'dark';
  };

  const translatorActions = ['utst-speak', 'utst-copy', 'utst-expand', 'utst-settings'];
  const translatorLabels = ['demoListen', 'demoCopy', 'demoExpand', 'demoSettings'];
  document.querySelectorAll('.translation-tools span').forEach((control, index) => {
    control.dataset.demoAction = translatorActions[index];
    control.dataset.i18nAria = translatorLabels[index];
    control.setAttribute('role', 'button');
    control.setAttribute('tabindex', '0');
  });
  document.querySelectorAll('.utst-close-button').forEach((control) => {
    control.dataset.demoAction = 'utst-close';
    control.dataset.i18nAria = 'demoClose';
    control.setAttribute('role', 'button');
    control.setAttribute('tabindex', '0');
  });

  const flashProductControl = (control, duration = 220) => {
    control.classList.remove('is-pressed');
    void control.offsetWidth;
    control.classList.add('is-pressed');
    window.setTimeout(() => control.classList.remove('is-pressed'), duration);
  };

  const activateProductControl = (control) => {
    const card = control.closest('.feature-card');
    if (!card) return;
    card.classList.add('has-manual-state');
    card.classList.remove('is-animated');
    const action = control.dataset.demoAction;
    const row = control.closest('.gf-script-row');

    if (action === 'gf-theme') {
      control.parentElement.querySelectorAll('button').forEach((button) => button.classList.toggle('is-active', button === control));
      const preference = control.dataset.demoThemeValue;
      const resolvedTheme = preference === 'system'
        ? (root.dataset.theme === 'light' ? 'light' : 'dark')
        : preference;
      const premiumApp = control.closest('.premium-app');
      if (premiumApp && resolvedTheme) premiumApp.dataset.demoTheme = resolvedTheme;
    } else if (action === 'gf-install') {
      flashProductControl(control);
    } else if (action === 'gf-favorite') {
      const favorite = control.classList.toggle('is-favorite');
      row?.classList.toggle('has-favorite', favorite);
    } else if (action === 'gf-detail') {
      flashProductControl(control);
    } else if (action === 'gf-note') {
      const panel = row?.querySelector('.gf-note-panel');
      if (panel) {
        const open = panel.classList.toggle('is-open');
        control.classList.toggle('is-active', open);
      } else {
        flashProductControl(control);
      }
    } else if (action === 'gf-note-delete' || action === 'gf-note-done') {
      row?.querySelector('.gf-note-panel')?.classList.remove('is-open');
      row?.querySelector('.gf-note-button')?.classList.remove('is-active');
    } else if (action === 'omni-export') {
      const frame = control.closest('.omni-frame');
      const menuKey = control.classList.contains('omni-inline-export') ? 'inline' : 'header';
      const menu = frame?.querySelector(`[data-export-menu="${menuKey}"]`);
      if (menuKey === 'inline' && frame && menu) {
        const actions = control.closest('.omni-message-actions');
        if (actions) {
          const frameBounds = frame.getBoundingClientRect();
          const actionsBounds = actions.getBoundingClientRect();
          const menuLeft = actionsBounds.left - frameBounds.left;
          const maxLeft = Math.max(8, frame.clientWidth - menu.offsetWidth - 8);
          menu.style.left = `${Math.min(maxLeft, Math.max(8, menuLeft))}px`;
          menu.style.top = `${actionsBounds.top - frameBounds.top - menu.offsetHeight - 7}px`;
          menu.style.right = 'auto';
          menu.style.bottom = 'auto';
        }
      }
      const open = !menu?.classList.contains('is-manual-open');
      frame?.querySelectorAll('.omni-format-menu').forEach((candidate) => candidate.classList.remove('is-manual-open'));
      frame?.querySelectorAll('[data-demo-action="omni-export"]').forEach((button) => button.classList.remove('is-active'));
      menu?.classList.toggle('is-manual-open', open);
      control.classList.toggle('is-active', open);
    } else if (action === 'omni-format') {
      const frame = control.closest('.omni-frame');
      const menu = control.closest('.omni-format-menu');
      menu?.querySelectorAll('[data-export-format]').forEach((option) => option.classList.toggle('is-selected', option === control));
      frame?.classList.add('is-manual-downloaded');
      window.setTimeout(() => {
        menu?.classList.remove('is-manual-open');
        frame?.querySelectorAll('[data-demo-action="omni-export"]').forEach((button) => button.classList.remove('is-active'));
      }, 140);
    } else if (action === 'omni-copy') {
      flashProductControl(control);
      navigator.clipboard?.writeText('# Project review\n\n- Reusable workflow').catch(() => {});
    } else if (action === 'omni-speak' || action === 'omni-vote-up' || action === 'omni-vote-down') {
      flashProductControl(control);
    } else if (action === 'omni-retry') {
      flashProductControl(control, 420);
      control.classList.remove('is-restarting');
      void control.offsetWidth;
      control.classList.add('is-restarting');
      window.setTimeout(() => control.classList.remove('is-restarting'), 600);
    } else if (action === 'utst-open') {
      flashProductControl(control);
      const frame = control.closest('.translator-frame');
      frame?.classList.remove('is-manual-closed');
      frame?.classList.add('is-manual-open');
    } else if (action === 'utst-close') {
      flashProductControl(control);
      const frame = control.closest('.translator-frame');
      frame?.classList.remove('is-manual-open');
      frame?.classList.add('is-manual-closed');
    } else if (action === 'utst-copy') {
      flashProductControl(control);
      navigator.clipboard?.writeText('ne jamais interrompre votre flux.').catch(() => {});
    } else if (action?.startsWith('utst-')) {
      flashProductControl(control);
    }
  };

  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-demo-action]');
    if (control) activateProductControl(control);
  });
  document.addEventListener('keydown', (event) => {
    const control = event.target.closest('[data-demo-action]');
    if (!control || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    activateProductControl(control);
  });

  document.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('mouseleave', () => {
      if (!mobileCardMotion.matches) resetProductDemo(card);
    });
  });

  const mobileCardMotion = window.matchMedia('(hover: none) and (pointer: coarse)');
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const featureCards = document.querySelectorAll('.feature-card');
    const cardAnimationObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!mobileCardMotion.matches || entry.intersectionRatio <= .08) {
          entry.target.classList.remove('is-animated');
          if (entry.intersectionRatio <= .08) resetProductDemo(entry.target);
          return;
        }
        if (entry.isIntersecting && entry.intersectionRatio >= .42) {
          entry.target.classList.add('is-animated');
        }
      });
    }, { threshold: [0, .08, .42], rootMargin: '0px 0px -8% 0px' });
    featureCards.forEach((card) => cardAnimationObserver.observe(card));

    const resetCardAnimations = () => {
      featureCards.forEach((card) => card.classList.remove('is-animated'));
    };
    mobileCardMotion.addEventListener?.('change', resetCardAnimations);
  }

  const savedTheme = storage.get('drewx-theme');
  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
  if (!savedTheme) setTheme(systemTheme.matches ? 'dark' : 'light', false);
  document.querySelectorAll('.premium-theme-controls [data-demo-theme-value="system"].is-active').forEach((control) => {
    const premiumApp = control.closest('.premium-app');
    if (premiumApp) premiumApp.dataset.demoTheme = root.dataset.theme === 'light' ? 'light' : 'dark';
  });
  applyProjectFilter(activeFilter);
  translatePage(currentLanguage);
  updateGreasyForkStats();
  updateHeaderGeometry();
  updateTranslatorMotionPath();
  updateScrollUI();
  document.documentElement.classList.add('ready');

  const alignInitialHash = () => {
    if (!location.hash) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.querySelector(location.hash);
      if (target) window.scrollTo(0, getAnchorDestination(target, location.hash));
    }));
  };
  alignInitialHash();
  if (document.readyState !== 'complete') {
    window.addEventListener('load', () => {
      updateHeaderGeometry();
      updateTranslatorMotionPath();
      alignInitialHash();
    }, { once: true });
  }
})();
