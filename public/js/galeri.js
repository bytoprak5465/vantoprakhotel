(function() {
  function t(key) { return (typeof window.__t === 'function') ? window.__t(key) : key; }
  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  var API_BASE = (function() {
    if (typeof window.__API_BASE === 'string' && window.__API_BASE) return window.__API_BASE.replace(/\/$/, '');
    if (window.location.protocol === 'file:' || !window.location.origin) return 'http://localhost:3000';
    return window.location.origin || '';
  })();

  var SECTION_LABELS = {
    odalar: 'Odalar',
    hizmetler: 'Hizmetler',
    slider: 'Slider',
    galeri: 'Galeri'
  };

  function toItem(item) {
    var url = (item.imageUrl || item.image_url || '').trim();
    return url ? { imageUrl: url, caption: (item.caption || '').trim() } : null;
  }

  function renderItemsInGrid(items, origin, wrap) {
    if (!wrap) return;
    var validItems = items.map(toItem).filter(Boolean);
    wrap.innerHTML = validItems.map(function(item, idx) {
      var url = item.imageUrl;
      var fullUrl = url.indexOf('http') === 0 ? url : origin + (url.charAt(0) === '/' ? url : '/' + url);
      var cap = item.caption;
      var safeUrl = fullUrl.replace(/"/g, '&quot;');
      return '<button type="button" class="gallery-item animate-on-scroll visible" data-src="' + safeUrl + '" data-caption="' + escapeHtml(cap).replace(/"/g, '&quot;') + '" aria-label="' + t('gallery.ariaZoom') + '">' +
        '<span class="gallery-item-inner"><img src="' + safeUrl + '" alt="" loading="lazy"></span>' +
        (cap ? '<span class="gallery-item-caption">' + escapeHtml(cap) + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function renderGrouped(grouped) {
    var container = document.getElementById('gallery-sections');
    var emptyEl = document.getElementById('gallery-empty');
    if (!container) return;
    var origin = API_BASE;
    var order = ['odalar', 'hizmetler', 'slider', 'galeri'];
    var hasAny = false;
    container.innerHTML = '';
    order.forEach(function(key) {
      var items = grouped[key];
      if (!Array.isArray(items) || items.length === 0) return;
      var valid = items.filter(function(item) { return toItem(item); });
      if (valid.length === 0) return;
      hasAny = true;
      var section = document.createElement('section');
      section.className = 'gallery-section';
      section.setAttribute('data-gallery-category', key);
      var title = document.createElement('h2');
      title.className = 'gallery-section-title';
      title.textContent = SECTION_LABELS[key] || key;
      var grid = document.createElement('div');
      grid.className = 'gallery-grid';
      section.appendChild(title);
      section.appendChild(grid);
      container.appendChild(section);
      renderItemsInGrid(valid, origin, grid);
    });
    if (emptyEl) emptyEl.style.display = hasAny ? 'none' : 'block';
    bindLightbox(container);
    bindObserver(container);
  }

  function renderFlat(items) {
    var container = document.getElementById('gallery-sections');
    var emptyEl = document.getElementById('gallery-empty');
    if (!container) return;
    var origin = API_BASE;
    var validItems = (items || []).map(toItem).filter(Boolean);
    if (validItems.length === 0) {
      container.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    var grid = document.createElement('div');
    grid.id = 'gallery-grid';
    grid.className = 'gallery-grid';
    container.innerHTML = '';
    container.appendChild(grid);
    renderItemsInGrid(validItems, origin, grid);
    bindLightbox(container);
    bindObserver(container);
  }

  function bindLightbox(root) {
    if (!root || root._galleryClickBound) return;
    root._galleryClickBound = true;
    root.addEventListener('click', function(e) {
      var btn = e.target.closest('.gallery-item');
      if (!btn) return;
      var src = (btn.getAttribute('data-src') || '').trim();
      if (!src) return;
      e.preventDefault();
      var caption = btn.getAttribute('data-caption') || '';
      var lb = document.getElementById('gallery-lightbox');
      if (!lb) return;
      var img = lb.querySelector('.gallery-lightbox-img');
      var capEl = lb.querySelector('.gallery-lightbox-caption');
      if (img) img.src = src;
      if (img) img.alt = caption;
      if (capEl) capEl.textContent = caption;
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  }

  function bindObserver(root) {
    if (!root || root._observerBound || !window.IntersectionObserver) return;
    root._observerBound = true;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    root.querySelectorAll('.animate-on-scroll').forEach(function(el) { observer.observe(el); });
  }

  function initLightbox() {
    var lb = document.getElementById('gallery-lightbox');
    if (!lb) return;
    var closeBtn = lb.querySelector('.gallery-lightbox-close');
    var backdrop = lb.querySelector('.gallery-lightbox-backdrop');
    function close() {
      lb.classList.remove('open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && lb.classList.contains('open')) close();
    });
  }

  function isGrouped(data) {
    return data && typeof data === 'object' && !Array.isArray(data) && (data.odalar || data.hizmetler || data.slider || data.galeri);
  }

  function run() {
    initLightbox();
    var container = document.getElementById('gallery-sections');
    if (!container) return;
    var grouped = typeof window.__GALLERY_GROUPED !== 'undefined' && window.__GALLERY_GROUPED;
    if (grouped && isGrouped(grouped)) {
      renderGrouped(grouped);
      return;
    }
    container.innerHTML = '<p class="section-subtitle">' + (t('common.loading') || 'Yükleniyor…') + '</p>';
    fetch(API_BASE + '/api/gallery?grouped=1')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (isGrouped(data)) {
          renderGrouped(data);
        } else {
          renderFlat(Array.isArray(data) ? data : []);
        }
      })
      .catch(function() {
        var initial = (typeof window.__GALLERY_DATA !== 'undefined' && Array.isArray(window.__GALLERY_DATA)) ? window.__GALLERY_DATA : [];
        renderFlat(initial);
      });
  }

  window.addEventListener('app:languageChanged', run);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
