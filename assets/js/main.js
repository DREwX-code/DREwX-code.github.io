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
    cacheKey: 'drewx-greasyfork-stats-v2',
    cacheDuration: 60 * 60 * 1000,
    endpoint: 'https://api.greasyfork.org/en/users/1259433.json'
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
    const dailyInstalls = scripts.reduce((total, script) => total + Number(script.daily_installs || 0), 0);
    const goodRatings = scripts.reduce((total, script) => total + Number(script.good_ratings || 0), 0);
    const okRatings = scripts.reduce((total, script) => total + Number(script.ok_ratings || 0), 0);
    const badRatings = scripts.reduce((total, script) => total + Number(script.bad_ratings || 0), 0);
    const ratingCount = goodRatings + okRatings + badRatings;
    const rating = ratingCount > 0 ? `${Math.round((goodRatings / ratingCount) * 100)}%` : '';
    const totalElement = document.querySelector('[data-gf-total-installs]');
    const countElement = document.querySelector('[data-gf-script-count]');
    if (totalElement) totalElement.textContent = formatCompactNumber(totalInstalls);
    if (countElement) countElement.textContent = String(scripts.length);

    const cardValues = {
      total_installs: formatCompactNumber(totalInstalls),
      daily_installs: formatCompactNumber(dailyInstalls),
      scripts: String(scripts.length),
      rating
    };
    document.querySelectorAll('[data-gf-card-stat]').forEach((element) => {
      const value = cardValues[element.dataset.gfCardStat];
      if (value) element.textContent = value;
    });
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

  const preferredLanguage = (navigator.language || 'en').toLowerCase().split('-')[0];
  const savedLanguage = storage.get('drewx-language');
  let currentLanguage = dictionary[savedLanguage] ? savedLanguage : (dictionary[preferredLanguage] ? preferredLanguage : 'en');

  const themeButton = document.querySelector('[data-theme-toggle]');
  const languageSelect = document.querySelector('[data-language-select]');
  let languageTrigger = null;
  let languageMenu = null;
  const languageFlags = { fr: 'fr', en: 'gb', es: 'es', pt: 'pt', zh: 'cn', hi: 'in' };
  const flagBase = new URL('../images/flags/', document.currentScript.src);
  const flagImage = (language) => `<img class="language-flag" src="${new URL(`${languageFlags[language]}.svg`, flagBase)}" alt="" width="20" height="15">`;
  if (languageSelect) {
    const container = document.createElement('div');
    container.className = 'language-picker';
    languageTrigger = document.createElement('button');
    languageTrigger.type = 'button';
    languageTrigger.className = 'language-trigger';
    languageTrigger.setAttribute('aria-expanded', 'false');
    languageTrigger.setAttribute('aria-controls', 'language-menu');
    languageMenu = document.createElement('div');
    languageMenu.id = 'language-menu';
    languageMenu.className = 'language-menu';
    languageMenu.hidden = true;
    Array.from(languageSelect.options).forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'language-option';
      item.dataset.language = option.value;
      item.lang = option.lang;
      item.innerHTML = `${flagImage(option.value)}<span>${option.textContent}</span><span class="language-check" aria-hidden="true">✓</span>`;
      languageMenu.append(item);
    });
    languageSelect.before(container);
    container.append(languageTrigger, languageMenu);
    languageSelect.hidden = true;
    const closeLanguageMenu = (returnFocus = false) => {
      languageMenu.hidden = true;
      languageTrigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) languageTrigger.focus();
    };
    languageTrigger.addEventListener('click', () => {
      const open = languageMenu.hidden;
      languageMenu.hidden = !open;
      languageTrigger.setAttribute('aria-expanded', String(open));
    });
    languageMenu.addEventListener('click', (event) => {
      const item = event.target.closest('[data-language]');
      if (!item) return;
      translatePage(item.dataset.language);
      closeLanguageMenu(true);
    });
    document.addEventListener('click', (event) => {
      if (!container.contains(event.target)) closeLanguageMenu();
    });
    container.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !languageMenu.hidden) {
        event.preventDefault();
        closeLanguageMenu(true);
      }
    });
  }
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

  let heroTitleIndex = 0;

  const translatePage = (language) => {
    const copy = dictionary[language];
    if (!copy) return;

    const viewportState = captureViewport();
    if (viewportState) languageSpacer.style.height = `${viewportState.documentHeight}px`;

    currentLanguage = language;
    heroTitleIndex = 0;
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

    if (languageSelect) languageSelect.value = language;
    if (languageTrigger && languageMenu) {
      const selected = languageSelect.selectedOptions[0];
      languageTrigger.innerHTML = `${flagImage(language)}<span lang="${language}">${selected.textContent}</span><svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4"/></svg>`;
      languageTrigger.setAttribute('aria-label', `${copy.languageLabel}: ${selected.textContent}`);
      languageMenu.querySelectorAll('[data-language]').forEach((item) => {
        item.setAttribute('aria-pressed', String(item.dataset.language === language));
      });
    }

    const meta = copy.meta;
    document.title = pageName === 'guides' ? copy.guideMetaTitle : (pageName === 'projects' ? meta.projectsTitle : meta.homeTitle);
    const description = pageName === 'guides' ? copy.guideMetaDescription : (pageName === 'projects' ? meta.projectsDescription : meta.homeDescription);
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (descriptionMeta) descriptionMeta.content = description;
    if (ogDescription) ogDescription.content = description;
    if (ogTitle) ogTitle.content = document.title;

    document.querySelectorAll('[data-project-details]').forEach(button => {
      const name = button.closest('.directory-card')?.querySelector('h2')?.textContent || '';
      button.setAttribute('aria-label', `${copy.projectOpenDetails} : ${name}`);
    });

    updateTranslatorLanguage(language);

    const guideCurrent = document.querySelector('.guide-aside [data-guide-current]');
    const activeGuideLink = document.querySelector('.guide-aside a[aria-current]') || document.querySelector('.guide-aside a');
    if (guideCurrent && activeGuideLink) guideCurrent.textContent = activeGuideLink.textContent;

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
    directoryCount.textContent = dictionary[currentLanguage].projectCount.replace('{count}', visible);
  };

  const projectDialog = document.querySelector('.project-dialog');
  if (projectDialog) {
    const previewImages = {
      premium: 'greasyfork-premium', omnichat: 'omnichat-exporter', translator: 'ultimate-translator',
      neuraveil: 'neuraveil', dino: 'dinocheat', securePass: 'sigilpass'
    };
    const title = projectDialog.querySelector('#project-dialog-title');
    const description = projectDialog.querySelector('#project-dialog-description');
    const imageBox = projectDialog.querySelector('.project-dialog-image');
    const preview = imageBox.querySelector('img');
    const highlights = projectDialog.querySelector('[data-project-highlights]');
    const actions = projectDialog.querySelector('.project-dialog-actions');
    let opener = null;

    const openProject = (card) => {
      const button = card.querySelector('[data-project-details]');
      if (!button) return;
      const key = button.dataset.projectDetails;
      const copy = dictionary[currentLanguage] || dictionary.en;
      opener = button;
      title.textContent = card.querySelector('h2').textContent;
      description.textContent = copy.projectIntro?.[key] || card.querySelector(':scope > div > p')?.textContent.trim() || '';
      highlights.replaceChildren(...(copy.projectFeatures?.[key] || []).map(text => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }));
      actions.replaceChildren(...[...card.querySelectorAll('.card-links a')].map(link => link.cloneNode(true)));
      const imageName = previewImages[key];
      imageBox.hidden = !imageName;
      if (imageName) {
        preview.src = `../assets/images/previews/${imageName}.webp`;
        preview.alt = `${copy.projectPreviewLabel} — ${title.textContent}`;
      } else {
        preview.removeAttribute('src');
        preview.alt = '';
      }
      button.focus({ preventScroll: true });
      projectDialog.showModal();
      document.body.classList.add('project-dialog-open');
      projectDialog.scrollTop = 0;
    };

    projectCards.forEach(card => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        const isTouch = event.pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches;
        if (!isTouch && !event.target.closest('button') && window.getSelection()?.toString().trim()) return;
        openProject(card);
      });
    });
    projectDialog.querySelector('[data-project-close]').addEventListener('click', () => projectDialog.close());
    projectDialog.addEventListener('click', (event) => { if (event.target === projectDialog) projectDialog.close(); });
    projectDialog.addEventListener('close', () => {
      document.body.classList.remove('project-dialog-open');
      opener?.focus({ preventScroll: true });
    });
  }

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

  languageSelect?.addEventListener('change', () => translatePage(languageSelect.value));

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

  const guideLinks = Array.from(document.querySelectorAll('.guide-aside a[href^="#"]'));
  const guideSections = guideLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const guideContents = document.querySelector('.guide-aside');
  const compactGuide = window.matchMedia('(max-width: 760px)');
  if (guideContents) {
    guideContents.open = !compactGuide.matches;
    compactGuide.addEventListener?.('change', event => { guideContents.open = !event.matches; });
  }
  guideLinks.forEach(link => link.addEventListener('click', () => {
    if (compactGuide.matches) guideContents.open = false;
  }));

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
    if (guideSections.length) {
      const guideThreshold = (headerGeometry.headerHeight || 0) + Math.min(window.innerHeight * .22, 160);
      let guideActive = guideSections[0].id;
      guideSections.forEach(section => { if (section.getBoundingClientRect().top <= guideThreshold) guideActive = section.id; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3) guideActive = guideSections[guideSections.length - 1].id;
      guideLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${guideActive}`;
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
        if (active) {
          const current = link.closest('.guide-aside')?.querySelector('[data-guide-current]');
          if (current && current.textContent !== link.textContent) current.textContent = link.textContent;
        }
      });
    }
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

  const noteStorageKey = 'drewx-premium-preview-note';
  const noteRow = document.querySelector('.gf-primary-row');
  const noteInput = noteRow?.querySelector('.gf-note-input');
  const notePreview = noteRow?.querySelector('.gf-note-preview');
  const updateNotePreview = () => {
    if (!noteInput || !notePreview) return;
    const value = noteInput.value.trim();
    notePreview.textContent = value;
    notePreview.hidden = !value || noteRow.querySelector('.gf-note-panel').classList.contains('is-open');
    noteRow.querySelector('.gf-note-button')?.setAttribute('data-has-note', String(Boolean(value)));
  };
  if (noteInput) {
    noteInput.value = storage.get(noteStorageKey) || '';
    updateNotePreview();
    noteInput.addEventListener('input', () => {
      storage.set(noteStorageKey, noteInput.value);
      updateNotePreview();
    });
  }

  const resetProductDemo = (card) => {
    if (card.contains(noteRow)) { noteRow?.querySelector('.gf-note-button')?.setAttribute('aria-expanded', 'false'); }
    card.classList.remove('has-manual-state');
    card.querySelectorAll('.is-installed, .is-favorite, .is-expanded, .is-open, .is-active, .is-copied, .is-restarting, .is-pressed, .is-selected')
      .forEach((element) => element.classList.remove('is-installed', 'is-favorite', 'is-expanded', 'is-open', 'is-active', 'is-copied', 'is-restarting', 'is-pressed', 'is-selected'));
    card.querySelectorAll('.has-favorite, .is-manual-open, .is-manual-closed, .is-manual-downloaded')
      .forEach((element) => element.classList.remove('has-favorite', 'is-manual-open', 'is-manual-closed', 'is-manual-downloaded'));
    card.querySelectorAll('.gf-install-button span').forEach((label) => { label.textContent = 'Install'; });
    card.querySelectorAll('.omni-format-menu').forEach((menu) => { menu.inert = true; });
    card.querySelectorAll('[data-demo-action="omni-export"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    const variantMenu = card.querySelector('.gf-variant-menu');
    if (variantMenu) {
      variantMenu.inert = true;
      variantMenu.querySelectorAll('[data-demo-variant]').forEach((button) => {
        const selected = button.dataset.demoVariant === 'full-dark';
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      card.querySelector('.gf-variant-toggle')?.setAttribute('aria-expanded', 'false');
    }
    card.querySelectorAll('.gf-density-demo [data-density]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.density === 'comfortable')));
    card.querySelector('.gf-density-demo [data-demo-action="gf-wide"]')?.setAttribute('aria-pressed', 'false');
    const densityApp = card.querySelector('.premium-app');
    if (densityApp) { densityApp.dataset.demoDensity = 'comfortable'; densityApp.classList.remove('is-demo-wide'); }
    if (card.contains(noteRow)) updateNotePreview();
    const systemThemeControl = card.querySelector('.premium-theme-controls button:nth-child(2)');
    systemThemeControl?.classList.add('is-active');
    const premiumApp = card.querySelector('.premium-app');
    if (premiumApp) { premiumApp.dataset.demoTheme = root.dataset.theme === 'light' ? 'light' : 'dark'; premiumApp.dataset.demoVariant = 'full-dark'; }
  };

  function updateTranslatorLanguage(language) {
    const frame = document.querySelector('.translator-frame');
    if (!frame) return;
    const names = new Intl.DisplayNames([language], { type: 'language' });
    const source = language === 'en' ? 'fr' : 'en';
    const sourceName = names.of(source) || source;
    const targetName = names.of(language) || language;
    const label = dictionary[language]?.utstDetect || 'Detect';
    frame.querySelector('[data-utst-source-label]').textContent = `${label} (${sourceName})`;
    frame.querySelector('[data-utst-target-label]').textContent = targetName;
    frame.querySelector('[data-utst-settings-target]').textContent = targetName;
    frame.querySelector('[data-utst-settings-interface]').textContent = targetName;
    const activeTheme = frame.querySelector('.translator-popover').dataset.utstTheme || 'blue';
    const themeKeys = { blue: 'utstThemeBlue', dark: 'utstThemeDark', light: 'utstThemeLight' };
    frame.querySelector('[data-utst-theme-current]').textContent = dictionary[language][themeKeys[activeTheme]];
  }

  const translatorFrame = document.querySelector('.translator-frame');
  const readerPage = translatorFrame?.querySelector('.reader-page');
  const translatorBubble = readerPage?.querySelector('.utst-selection-bubble');
  const translationResult = translatorFrame?.querySelector('.translation-result');
  let selectedDemoText = '';
  let translatedDemoSource = '';
  let translationRequest = null;

  const captureDemoSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!readerPage?.contains(range.startContainer) || !readerPage.contains(range.endContainer)
      || translatorBubble.contains(range.commonAncestorContainer)) return;
    const text = selection.toString().trim();
    if (!text) return;
    selectedDemoText = text;
    translationRequest?.abort();
    const bounds = range.getBoundingClientRect();
    const pageBounds = readerPage.getBoundingClientRect();
    const scaleX = pageBounds.width / readerPage.offsetWidth || 1;
    const scaleY = pageBounds.height / readerPage.offsetHeight || 1;
    const bubbleLeft = (bounds.left - pageBounds.left + bounds.width / 2) / scaleX - translatorBubble.offsetWidth / 2;
    translatorBubble.style.left = `${Math.max(4, Math.min(readerPage.clientWidth - translatorBubble.offsetWidth - 4, bubbleLeft))}px`;
    translatorBubble.style.top = `${(bounds.bottom - pageBounds.top) / scaleY + 7}px`;
    translatorFrame.closest('.feature-card')?.classList.add('has-utst-interaction', 'has-manual-state');
    translatorFrame.classList.add('has-user-selection');
    translatorFrame.classList.remove('is-bubble-closed', 'is-manual-open', 'is-settings-open');
    translatorFrame.classList.add('is-manual-closed', 'is-bubble-open');
    translatorSettings.hidden = true;
    themeMenu.hidden = true;
    themeTrigger.setAttribute('aria-expanded', 'false');
  };
  translatorBubble?.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) event.preventDefault();
  });
  document.addEventListener('selectionchange', () => {
    if (!translatorFrame) return;
    const selection = window.getSelection();
    const selectedHere = selection && !selection.isCollapsed && selection.toString().trim()
      && readerPage.contains(selection.anchorNode) && readerPage.contains(selection.focusNode);
    if (selectedHere) return;
    if (translatorFrame.classList.contains('is-bubble-open')) {
      translatorFrame.classList.remove('is-bubble-open');
      translatorFrame.classList.add('is-bubble-closed');
      selectedDemoText = '';
    }
    if (!translatorFrame.classList.contains('is-manual-open') && !translatorFrame.classList.contains('is-side-open')) {
      translatorFrame.closest('.feature-card')?.classList.remove('has-utst-interaction', 'has-manual-state');
    }
  });
  readerPage?.addEventListener('pointerup', (event) => {
    if (!event.target.closest('.utst-selection-bubble')) requestAnimationFrame(captureDemoSelection);
  });
  readerPage?.addEventListener('keyup', (event) => {
    if (event.key === 'Shift' || event.key.startsWith('Arrow')) requestAnimationFrame(captureDemoSelection);
  });

  const translateDemoSelection = async () => {
    if (!translationResult || !selectedDemoText) return;
    translationRequest?.abort();
    const controller = new AbortController();
    translationRequest = controller;
    const targetLanguage = currentLanguage;
    const sourceText = selectedDemoText;
    translatedDemoSource = sourceText;
    translatorFrame.querySelector('.utst-side-source').textContent = sourceText;
    const labels = dictionary[targetLanguage] || dictionary.en;
    translationResult.textContent = labels.demoTranslating;
    const params = new URLSearchParams({ client: 'gtx', sl: 'auto', tl: targetLanguage, dt: 't', q: sourceText });
    try {
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Translation request failed');
      const data = await response.json();
      const text = Array.isArray(data[0]) ? data[0].map(part => part?.[0] || '').join('') : '';
      if (!text.trim()) throw new Error('Empty translation');
      if (!controller.signal.aborted && currentLanguage === targetLanguage) {
        translationResult.textContent = text;
        translatorFrame.querySelector('.utst-side-result').textContent = text;
        if (typeof data[2] === 'string') {
          try {
            const names = new Intl.DisplayNames([currentLanguage], { type: 'language' });
            const detected = names.of(data[2]) || data[2];
            translatorFrame.querySelector('[data-utst-source-label]').textContent = `${labels.utstDetect} (${detected})`;
          } catch { /* Keep the existing source label if the language code is unsupported. */ }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError' && currentLanguage === targetLanguage) translationResult.textContent = labels.demoTranslationError;
    }
  };

  const translatorActions = ['utst-speak', 'utst-copy', 'utst-expand', 'utst-settings'];
  const translatorLabels = ['demoListen', 'demoCopy', 'utstOpenPanel', 'demoSettings'];
  document.querySelectorAll('.translation-tools span').forEach((control, index) => {
    control.dataset.i18nAria = translatorLabels[index];
    control.setAttribute('role', 'button');
    if (index === 1 || index === 2 || index === 3) {
      control.dataset.demoAction = translatorActions[index];
      control.setAttribute('tabindex', '0');
      if (index === 3) control.setAttribute('aria-expanded', 'false');
    } else {
      control.setAttribute('aria-disabled', 'true');
    }
  });

  const translatorPanel = translatorFrame?.querySelector('.translator-popover');
  const translatorHandle = translatorFrame?.querySelector('.translator-handle');
  const translatorSettings = translatorFrame?.querySelector('.utst-settings-panel');
  const sidePanel = translatorFrame?.querySelector('.utst-side-panel');
  const themeMenu = translatorFrame?.querySelector('.utst-theme-menu');
  const themeTrigger = translatorFrame?.querySelector('.utst-theme-trigger');
  const copyTimers = new WeakMap();
  const showCopyFeedback = control => {
    const original = control.querySelector('svg');
    if (!original) return;
    let state = copyTimers.get(control);
    if (!state) state = { svg: original.outerHTML, timer: 0 };
    window.clearTimeout(state.timer);
    original.outerHTML = '<svg class="utst-copy-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>';
    control.classList.add('utst-copy-success');
    state.timer = window.setTimeout(() => {
      const check = control.querySelector('.utst-copy-check');
      if (check) check.outerHTML = state.svg;
      control.classList.remove('utst-copy-success');
      copyTimers.delete(control);
    }, 900);
    copyTimers.set(control, state);
  };
  translatorHandle?.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !translatorFrame.classList.contains('is-manual-open')) return;
    const frameBounds = translatorFrame.getBoundingClientRect();
    const panelBounds = translatorPanel.getBoundingClientRect();
    const scaleX = frameBounds.width / translatorFrame.offsetWidth || 1;
    const scaleY = frameBounds.height / translatorFrame.offsetHeight || 1;
    const startX = event.clientX, startY = event.clientY;
    const left = (panelBounds.left - frameBounds.left) / scaleX;
    const top = (panelBounds.top - frameBounds.top) / scaleY;
    const maxLeft = Math.max(0, translatorFrame.clientWidth - translatorPanel.offsetWidth);
    const minTop = translatorFrame.querySelector('.product-toolbar')?.offsetHeight || 0;
    const maxTop = Math.max(minTop, translatorFrame.clientHeight - translatorPanel.offsetHeight);
    translatorHandle.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      if (moveEvent.pointerId !== event.pointerId) return;
      translatorPanel.style.left = `${Math.max(0, Math.min(maxLeft, left + (moveEvent.clientX - startX) / scaleX))}px`;
      translatorPanel.style.top = `${Math.max(minTop, Math.min(maxTop, top + (moveEvent.clientY - startY) / scaleY))}px`;
      translatorPanel.style.right = 'auto';
      translatorPanel.style.bottom = 'auto';
    };
    const end = endEvent => {
      if (endEvent.pointerId !== event.pointerId) return;
      translatorHandle.removeEventListener('pointermove', move);
      translatorHandle.removeEventListener('pointerup', end);
      translatorHandle.removeEventListener('pointercancel', end);
    };
    translatorHandle.addEventListener('pointermove', move);
    translatorHandle.addEventListener('pointerup', end);
    translatorHandle.addEventListener('pointercancel', end);
    event.preventDefault();
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
      control.parentElement.querySelectorAll(':scope > [data-demo-theme-value]').forEach((button) => button.classList.toggle('is-active', button === control));
      const preference = control.dataset.demoThemeValue;
      const resolvedTheme = preference === 'system'
        ? (root.dataset.theme === 'light' ? 'light' : 'dark')
        : preference;
      const premiumApp = control.closest('.premium-app');
      if (premiumApp && resolvedTheme) premiumApp.dataset.demoTheme = resolvedTheme;
    } else if (action === 'gf-variant-toggle') {
      const menu = control.parentElement.querySelector('.gf-variant-menu');
      const open = menu.classList.toggle('is-open');
      menu.inert = !open;
      control.setAttribute('aria-expanded', String(open));
    } else if (action === 'gf-variant') {
      const premiumApp = control.closest('.premium-app');
      if (premiumApp) {
        premiumApp.dataset.demoVariant = control.dataset.demoVariant;
        if (control.dataset.demoVariant === 'full-dark') {
          premiumApp.dataset.demoTheme = 'dark';
          premiumApp.querySelectorAll('[data-demo-theme-value]').forEach((button) => button.classList.toggle('is-active', button.dataset.demoThemeValue === 'dark'));
        }
      }
      control.parentElement.querySelectorAll('[data-demo-variant]').forEach((button) => {
        button.classList.toggle('is-selected', button === control);
        button.setAttribute('aria-pressed', String(button === control));
      });
      control.parentElement.classList.remove('is-open');
      control.parentElement.inert = true;
      control.parentElement.parentElement.querySelector('.gf-variant-toggle')?.setAttribute('aria-expanded', 'false');
    } else if (action === 'gf-density') {
      const app = control.closest('.premium-app');
      if (app) app.dataset.demoDensity = control.dataset.density;
      control.parentElement.querySelectorAll('[data-density]').forEach((button) => button.setAttribute('aria-pressed', String(button === control)));
    } else if (action === 'gf-wide') {
      const app = control.closest('.premium-app');
      const active = app?.classList.toggle('is-demo-wide');
      control.setAttribute('aria-pressed', String(Boolean(active)));
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
        control.setAttribute('aria-expanded', String(open));
        if (row === noteRow) notePreview.hidden = open || !noteInput.value.trim();
        if (open) panel.querySelector('.gf-note-input')?.focus({ preventScroll: true });
      } else {
        flashProductControl(control);
      }
    } else if (action === 'gf-note-delete' || action === 'gf-note-done') {
      if (row === noteRow) {
        if (action === 'gf-note-delete') noteInput.value = '';
        storage.set(noteStorageKey, noteInput.value);
        updateNotePreview();
      }
      row?.querySelector('.gf-note-panel')?.classList.remove('is-open');
      if (row === noteRow) updateNotePreview();
      const noteButton = row?.querySelector('.gf-note-button');
      noteButton?.classList.remove('is-active');
      noteButton?.setAttribute('aria-expanded', 'false');
    } else if (action === 'omni-export') {
      const frame = control.closest('.omni-frame');
      const menuKey = control.classList.contains('omni-inline-export') ? 'inline' : 'header';
      const menu = frame?.querySelector(`[data-export-menu="${menuKey}"]`);
      const open = !menu?.classList.contains('is-manual-open');
      frame?.querySelectorAll('.omni-format-menu').forEach((candidate) => { candidate.classList.remove('is-manual-open'); candidate.inert = true; });
      frame?.querySelectorAll('[data-demo-action="omni-export"]').forEach((button) => { button.classList.remove('is-active'); button.setAttribute('aria-expanded', 'false'); });
      if (menu) { menu.classList.toggle('is-manual-open', open); menu.inert = !open; }
      control.classList.toggle('is-active', open);
      control.setAttribute('aria-expanded', String(open));
      if (open && frame && menu) {
        const frameBounds = frame.getBoundingClientRect();
        const buttonBounds = control.getBoundingClientRect();
        const scaleX = frameBounds.width / frame.offsetWidth;
        const scaleY = frameBounds.height / frame.offsetHeight;
        const buttonLeft = (buttonBounds.left - frameBounds.left) / scaleX;
        const buttonRight = (buttonBounds.right - frameBounds.left) / scaleX;
        const buttonTop = (buttonBounds.top - frameBounds.top) / scaleY;
        const buttonBottom = (buttonBounds.bottom - frameBounds.top) / scaleY;
        const left = Math.max(6, Math.min(frame.clientWidth - menu.offsetWidth - 6, buttonRight - menu.offsetWidth));
        const desiredTop = menuKey === 'header' ? buttonBottom + 5 : buttonTop - menu.offsetHeight - 5;
        menu.style.left = `${left}px`;
        menu.style.top = `${Math.max(6, Math.min(frame.clientHeight - menu.offsetHeight - 6, desiredTop))}px`;
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
      }
    } else if (action === 'omni-format') {
      const frame = control.closest('.omni-frame');
      const menu = control.closest('.omni-format-menu');
      menu?.querySelectorAll('[data-export-format]').forEach((option) => option.classList.toggle('is-selected', option === control));
      if (menu) { menu.classList.remove('is-manual-open'); menu.inert = true; }
      frame?.querySelectorAll('[data-demo-action="omni-export"]').forEach((button) => { button.classList.remove('is-active'); button.setAttribute('aria-expanded', 'false'); });
      window.dispatchEvent(new CustomEvent('drewx-omni-export', { detail: { format: control.dataset.exportFormat, scope: menu?.dataset.exportMenu } }));
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
      frame?.classList.remove('is-bubble-open');
      frame?.classList.add('is-bubble-closed');
      if (selectedDemoText) void translateDemoSelection();
    } else if (action === 'utst-bubble-close') {
      translationRequest?.abort();
      card.classList.add('has-utst-interaction');
      translatorFrame?.classList.remove('is-bubble-open');
      translatorFrame?.classList.add('is-bubble-closed');
    } else if (action === 'utst-close') {
      flashProductControl(control);
      translationRequest?.abort();
      const frame = control.closest('.translator-frame');
      frame?.classList.remove('is-manual-open');
      frame?.classList.add('is-manual-closed');
      card.classList.remove('has-utst-interaction', 'has-manual-state');
      translatorSettings.hidden = true;
      themeMenu.hidden = true;
      themeTrigger.setAttribute('aria-expanded', 'false');
      frame?.classList.remove('is-settings-open');
      frame?.querySelector('[data-demo-action=utst-settings]')?.setAttribute('aria-expanded', 'false');
    } else if (action === 'utst-copy' || action === 'utst-side-copy-source' || action === 'utst-side-copy-result') {
      const text = action === 'utst-side-copy-source' ? sidePanel.querySelector('.utst-side-source').textContent
        : action === 'utst-side-copy-result' ? sidePanel.querySelector('.utst-side-result').textContent
        : translationResult?.textContent || '';
      if (navigator.clipboard?.writeText && text) {
        navigator.clipboard.writeText(text).then(() => showCopyFeedback(control)).catch(() => {});
      }
    } else if (action === 'utst-theme-toggle') {
      const open = themeMenu.hidden;
      themeMenu.hidden = !open;
      themeTrigger.setAttribute('aria-expanded', String(open));
    } else if (action === 'utst-theme') {
      const theme = control.dataset.utstTheme;
      if (!['blue', 'dark', 'light'].includes(theme)) return;
      translatorPanel.dataset.utstTheme = theme;
      sidePanel.dataset.utstTheme = theme;
      themeMenu.querySelectorAll('[data-utst-theme]').forEach(button => button.setAttribute('aria-selected', String(button === control)));
      themeTrigger.querySelector('[data-swatch]').dataset.swatch = theme;
      themeTrigger.querySelector('[data-utst-theme-current]').textContent = control.querySelector('[data-i18n]').textContent;
      themeMenu.hidden = true;
      themeTrigger.setAttribute('aria-expanded', 'false');
    } else if (action === 'utst-expand') {
      translatorFrame.querySelector('.utst-side-source').textContent = translatedDemoSource || selectedDemoText || readerPage.querySelector('mark')?.textContent || '';
      translatorFrame.querySelector('.utst-side-result').textContent = translationResult?.textContent || '';
      sidePanel.inert = false;
      sidePanel.setAttribute('aria-hidden', 'false');
      translatorFrame.classList.add('is-side-open', 'is-manual-open');
    } else if (action === 'utst-panel-close') {
      translatorFrame.classList.remove('is-side-open');
      sidePanel.inert = true;
      sidePanel.setAttribute('aria-hidden', 'true');
    } else if (action === 'utst-settings' || action === 'utst-settings-close') {
      const open = action === 'utst-settings' && translatorSettings.hidden;
      translatorSettings.hidden = !open;
      if (!open) { themeMenu.hidden = true; themeTrigger.setAttribute('aria-expanded', 'false'); }
      translatorFrame.classList.toggle('is-settings-open', open);
      translatorFrame.querySelector('[data-demo-action="utst-settings"]')?.setAttribute('aria-expanded', String(open));
    }
  };

  document.addEventListener('click', (event) => {
    const control = event.target.closest('[data-demo-action]');
    if (control) activateProductControl(control);
  });
  document.addEventListener('keydown', (event) => {
    const control = event.target.closest('[data-demo-action]');
    if (!control || control.matches('button, a') || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    activateProductControl(control);
  });

  document.querySelectorAll('.feature-card').forEach((card) => {
    card.addEventListener('mouseleave', () => {
      if (!mobileCardMotion.matches && !card.classList.contains('has-utst-interaction')) resetProductDemo(card);
    });
  });

  const heroTitle = document.getElementById('hero-title');
  if (heroTitle && !reducedMotion) {
    window.setInterval(() => {
      const word = heroTitle.querySelector('.hero-word');
      const words = dictionary[currentLanguage]?.heroWords;
      if (document.hidden || heroTitle.getBoundingClientRect().bottom < 0 || !word || !words?.length) return;
      const next = (heroTitleIndex + 1) % words.length;
      const animation = word.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
      animation.onfinish = () => {
        if (!word.isConnected) return;
        heroTitleIndex = next;
        word.textContent = dictionary[currentLanguage].heroWords[next];
        animation.cancel();
        word.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 250, easing: 'ease-out' });
      };
    }, 5500);
  }

  const mobileCardMotion = window.matchMedia('(hover: none) and (pointer: coarse)');

  const savedTheme = storage.get('drewx-theme');
  document.querySelectorAll('[data-year]').forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
  if (!savedTheme) setTheme(systemTheme.matches ? 'dark' : 'light', false);
  document.querySelectorAll('.premium-theme-controls [data-demo-theme-value="system"].is-active').forEach((control) => {
    const premiumApp = control.closest('.premium-app');
    if (premiumApp) { premiumApp.dataset.demoTheme = root.dataset.theme === 'light' ? 'light' : 'dark'; premiumApp.dataset.demoVariant = 'full-dark'; }
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
