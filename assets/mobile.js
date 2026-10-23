/* TONY Studio — mobile-first workflow, all existing desktop functionality preserved. */
(function () {
  'use strict';

  const LABELS = {
    story: { title: 'Haberi hazırla', number: '01', note: 'Manşet, kaynak ve konum' },
    design: { title: 'Görseli düzenle', number: '02', note: 'Fotoğraf ve canlı ön izleme' },
    publish: { title: 'Yayına hazırla', number: '03', note: 'Instagram, PNG ve taslaklar' }
  };
  const VIEWS = ['story', 'design', 'publish'];
  const $ = id => document.getElementById(id);
  const mobile = () => window.matchMedia('(max-width: 767px)').matches;

  function bindPanels() {
    const main = document.querySelector('main');
    const cols = Array.from(main ? main.children : []).filter(el => el.tagName === 'SECTION');
    if (cols.length < 2) return false;
    const left = cols[0];
    const right = cols[1];
    const native = Array.from(left.children).filter(el => el.tagName === 'DIV' && !el.id);
    const previewAndFeed = Array.from(right.children).filter(el => el.tagName === 'DIV');
    if (native.length < 4 || previewAndFeed.length < 2) return false;
    const mapping = [
      [ $('tonyArticlePanel'), 'story', 1 ],
      [ native[1], 'story', 2 ],
      [ native[2], 'story', 3 ],
      [ previewAndFeed[0], 'design', 1 ],
      [ native[0], 'design', 2 ],
      [ native[3], 'design', 3 ],
      [ $('tonyIgPanel'), 'publish', 2 ],
      [ previewAndFeed[1], 'publish', 3 ]
    ];
    for (const [node, view, order] of mapping) {
      if (!node) return false;
      node.classList.add('tony-mobile-panel');
      node.dataset.tonyMobilePanel = view;
      node.style.setProperty('--tony-mobile-order', String(order));
    }
    previewAndFeed[0].id = 'tonyMobilePreviewPanel';
    previewAndFeed[1].id = 'tonyMobileFeedPanel';
    native[0].id = 'tonyMobilePhotoPanel';
    native[1].id = 'tonyMobileTextPanel';
    native[2].id = 'tonyMobileDatePanel';
    native[3].id = 'tonyMobileBrandPanel';
    return true;
  }

  function createNavigation() {
    const header = document.querySelector('body > header');
    const main = document.querySelector('main');
    if (!header || !main) return;
    const nav = document.createElement('nav');
    nav.id = 'tonyMobileNavigation';
    nav.className = 'tony-mobile-only tony-mobile-navigation';
    nav.setAttribute('aria-label', 'Mobil haber oluşturma aşamaları');
    nav.innerHTML = [
      '<div class="tony-mobile-heading">',
      ' <div><span class="tony-mobile-eyebrow">THE ONLY NEW YORK <span aria-hidden="true">•</span> NEWSROOM</span>',
      ' <h1 id="tonyMobileScreenTitle">Haberi hazırla</h1></div>',
      ' <span id="tonyMobileProgress" class="tony-mobile-progress">01 / 03</span>',
      '</div>',
      '<div class="tony-mobile-tabs" role="tablist" aria-label="Haber aşamaları">',
      '<button type="button" role="tab" data-tony-tab="story" aria-controls="tonyMobileTextPanel" aria-selected="true"><span class="tony-mobile-tab-num">01</span>Haber</button>',
      '<button type="button" role="tab" data-tony-tab="design" aria-controls="tonyMobilePreviewPanel" aria-selected="false"><span class="tony-mobile-tab-num">02</span>Tasarım</button>',
      '<button type="button" role="tab" data-tony-tab="publish" aria-controls="tonyIgPanel" aria-selected="false"><span class="tony-mobile-tab-num">03</span>Yayın</button>',
      '</div>',
      '<p id="tonyMobileStepNote" class="tony-mobile-step-note">Manşet, kaynak ve konum</p>'
    ].join('');
    header.after(nav);

    const bar = document.createElement('div');
    bar.id = 'tonyMobileActions';
    bar.className = 'tony-mobile-only tony-mobile-actions';
    bar.innerHTML = [
      '<div class="tony-mobile-actions-inner">',
      '<button type="button" id="tonyMobileBack" class="tony-mobile-back" aria-label="Önceki adıma dön">‹ <span>Geri</span></button>',
      '<button type="button" id="tonyMobileSecondary" class="tony-mobile-secondary" hidden>PNG indir</button>',
      '<button type="button" id="tonyMobileNext" class="tony-mobile-primary">Tasarıma geç <span aria-hidden="true">→</span></button>',
      '</div>'
    ].join('');
    document.body.appendChild(bar);

    for (const button of nav.querySelectorAll('[data-tony-tab]')) {
      button.addEventListener('click', () => switchView(button.dataset.tonyTab));
      button.addEventListener('keydown', event => {
        if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = VIEWS.indexOf(button.dataset.tonyTab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? VIEWS.length - 1
          : (current + (event.key === 'ArrowRight' ? 1 : -1) + VIEWS.length) % VIEWS.length;
        switchView(VIEWS[next]);
        nav.querySelector('[data-tony-tab="' + VIEWS[next] + '"]').focus();
      });
    }
    $('tonyMobileBack').addEventListener('click', () => {
      const current = VIEWS.indexOf(document.body.dataset.tonyMobileView);
      switchView(VIEWS[Math.max(0, current - 1)]);
    });
    $('tonyMobileSecondary').addEventListener('click', () => $('btnDownloadPNG')?.click());
    $('tonyMobileNext').addEventListener('click', () => {
      const current = document.body.dataset.tonyMobileView;
      if (current === 'story') switchView('design');
      else if (current === 'design') switchView('publish');
      else {
        const publish = $('tonyIgPublish');
        if (publish && !publish.disabled) publish.click(); // Existing explicit publish confirmation remains mandatory.
        else {
          $('tonyIgPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          $('tonyIgConnect') && !$('tonyIgConnect').classList.contains('hidden')
            ? $('tonyIgConnect').focus({ preventScroll: true })
            : $('tonyIgMessage')?.focus({ preventScroll: true });
        }
      }
    });
    const summary = document.createElement('div');
    summary.id = 'tonyMobilePublishSummary';
    summary.className = 'tony-mobile-only tony-mobile-panel tony-mobile-publish-summary';
    summary.dataset.tonyMobilePanel = 'publish';
    summary.style.setProperty('--tony-mobile-order', '1');
    summary.innerHTML = [
      '<div class="tony-mobile-summary-head">',
      ' <span class="tony-mobile-eyebrow">GÖNDERİ ÖN İZLEMESİ</span>',
      ' <button id="tonyMobileEditDesign" type="button" class="tony-mobile-inline-link">Görsele dön ↗</button>',
      '</div>',
      '<div class="tony-mobile-summary-body">',
      ' <img id="tonyMobileSummaryImage" alt="Gönderinin son görsel ön izlemesi" />',
      ' <div><p class="tony-mobile-summary-kicker">TONY. / THE ONLY NEW YORK</p>',
      ' <p id="tonyMobileSummaryTitle" class="tony-mobile-summary-title"></p>',
      ' <p id="tonyMobileSummaryRegion" class="tony-mobile-summary-region"></p></div>',
      '</div>'
    ].join('');
    main.prepend(summary);
    $('tonyMobileEditDesign').addEventListener('click', () => switchView('design'));
  }

  function addBoroughShortcuts() {
    const chips = document.querySelector('.region-chip')?.parentElement;
    if (!chips) return;
    for (const borough of ['BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND']) {
      if (chips.querySelector('[data-region="' + borough + '"]')) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'region-chip tony-mobile-borough';
      button.dataset.region = borough;
      button.textContent = borough;
      button.addEventListener('click', () => {
        const app = window.TONYStudio;
        const input = $('regionInput');
        if (!app || !input) return;
        input.value = borough;
        app.state.region = borough;
        app.renderCanvas();
        updateStatus();
      });
      chips.appendChild(button);
    }
  }

  function addAdvancedSettings() {
    const brand = $('tonyMobileBrandPanel');
    if (!brand) return;
    const trigger = document.createElement('button');
    trigger.id = 'tonyMobileBrandToggle';
    trigger.type = 'button';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'tonyMobileBrandSettings');
    trigger.className = 'tony-mobile-only tony-mobile-advanced-toggle';
    trigger.innerHTML = '<span>Gelişmiş logo ve şablon ayarları</span><span aria-hidden="true">⌄</span>';
    const children = Array.from(brand.children);
    const content = document.createElement('div');
    content.id = 'tonyMobileBrandSettings';
    for (const child of children) content.appendChild(child);
    brand.append(trigger, content);
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', String(open));
      brand.classList.toggle('tony-mobile-expanded', open);
    });
  }

  function updateStatus() {
    const s = window.TONYStudio?.state;
    if (!s) return;
    const label = $('tonyMobileSummaryTitle');
    const region = $('tonyMobileSummaryRegion');
    if (label) label.textContent = s.headline?.trim() || 'Yeni haber başlığı';
    if (region) region.textContent = '📍 ' + (s.region || 'NEW YORK CITY');
  }

  function refreshSummary() {
    updateStatus();
    const app = window.TONYStudio;
    const img = $('tonyMobileSummaryImage');
    if (!img || !app) return;
    try {
      app.renderCanvas();
      img.src = app.canvas.toDataURL('image/jpeg', 0.55);
    } catch {
      img.removeAttribute('src');
      img.alt = 'Ön izleme henüz hazır değil';
    }
  }

  function switchView(view, { scroll = true } = {}) {
    if (!LABELS[view]) return;
    document.body.dataset.tonyMobileView = view;
    const selected = VIEWS.indexOf(view);
    const label = LABELS[view];
    $('tonyMobileScreenTitle').textContent = label.title;
    $('tonyMobileProgress').textContent = label.number + ' / 03';
    $('tonyMobileStepNote').textContent = label.note;
    for (const button of document.querySelectorAll('[data-tony-tab]')) {
      const active = button.dataset.tonyTab === view;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    const back = $('tonyMobileBack');
    back.hidden = selected === 0;
    $('tonyMobileSecondary').hidden = view !== 'publish';
    const primary = $('tonyMobileNext');
    primary.innerHTML = view === 'story' ? 'Tasarıma geç <span aria-hidden="true">→</span>'
      : view === 'design' ? 'Yayına geç <span aria-hidden="true">→</span>'
      : 'Instagram’a gönder <span aria-hidden="true">↗</span>';
    if (view === 'publish') refreshSummary();
    if (view === 'design') window.TONYStudio?.renderCanvas();
    if (scroll && mobile()) {
      // Blur keyboard before moving to another step. Use explicit scroll instead of changing browser history.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }

  function enhanceTextControls() {
    const input = $('headlineInput');
    const count = document.createElement('span');
    count.id = 'tonyMobileHeadlineCount';
    count.className = 'tony-mobile-only tony-mobile-counter';
    input?.insertAdjacentElement('afterend', count);
    const paint = () => {
      if (count && input) count.textContent = input.value.length + ' karakter';
      updateStatus();
    };
    input?.addEventListener('input', paint);
    $('regionInput')?.addEventListener('input', updateStatus);
    paint();
  }

  function init() {
    if (!window.TONYStudio || !bindPanels()) return;
    createNavigation();
    addBoroughShortcuts();
    addAdvancedSettings();
    enhanceTextControls();
    switchView('story', { scroll: false });
  }
  document.addEventListener('DOMContentLoaded', init);
  window.TONYMobile = { switchView };
})();
