/* =====================================================================
   index.html · page behaviour. Loads with `defer` after site.js and
   motion.js; queued through AMQ so it runs once window.AM is ready.
   Everything here is progressive: the page reads and converts without it.
   ===================================================================== */
(window.AMQ = window.AMQ || []).push(function (AM) {
  'use strict';
  var d = document, root = d.documentElement, C = window.CONFIG || {};
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  var reduced = AM.reducedMotion();
  var fine = matchMedia('(pointer: fine)').matches;
  var rtl = function () { return root.dir === 'rtl'; };
  var raf = window.requestAnimationFrame.bind(window);

  /* ---------- Links from CONFIG ---------- */
  $$('[data-config-href]').forEach(function (a) {
    var k = a.getAttribute('data-config-href'), v = C[k];
    if (v) a.setAttribute('href', k === 'email' ? 'mailto:' + v : v);
  });

  /* ---------- Kids photos: blurred until consent is confirmed (CONFIG.kidsPhotos) ---------- */
  if (C.kidsPhotos === 'original') {
    $$('img[data-kids-photo]').forEach(function (img) { img.src = img.src.replace('/proof/blurred/', '/proof/'); });
  }

  /* The featured workshop shows its details open on desktop only */
  if (!matchMedia('(min-width: 1024px)').matches) $$('.card--feature details[open]').forEach(function (el) { el.open = false; });

  /* ---------- Next-session band: state from CONFIG.eventDate ---------- */
  function sessionUI() {
    var ws = AM.session.workshopState();
    var band = $('[data-session-card]');
    if (band) band.setAttribute('data-state', ws);
    var listed = !!AM.store.get('am_waitlisted') && (ws === 'waitlist' || ws === 'full');
    $$('[data-waitlisted]').forEach(function (el) { el.hidden = !listed; });
    $$('[data-not-waitlisted]').forEach(function (el) { el.hidden = listed; });
  }
  sessionUI();
  d.addEventListener('am:lang', sessionUI);

  /* ---------- Free guide: progress stored on this device by learn-ai ---------- */
  (function guideUI() {
    var st = null;
    try { st = JSON.parse(AM.store.get('am_learn_v1') || 'null'); } catch (e) { st = null; }
    var done = st && Array.isArray(st.done) ? st.done.map(Number).filter(function (n) { return n >= 1 && n <= 9; }) : [];
    var next = done.length ? (parseInt(st.last, 10) || Math.min(9, Math.max.apply(null, done) + 1)) : 1;
    next = Math.min(9, Math.max(1, next));
    var q = AM.lang === 'en' ? '?lang=en' : '';
    $$('.tree__row').forEach(function (row) {
      var n = parseInt(row.getAttribute('data-mod'), 10);
      row.classList.toggle('is-done', done.indexOf(n) > -1);
      row.classList.toggle('is-next', n === next);
    });
    var count = $('[data-tree-count]'); if (count) count.textContent = done.length + '/9';
    var bar = $('[data-tree-bar]');
    if (bar) {
      var p = done.length / 9;
      if (reduced || !('IntersectionObserver' in window)) bar.style.setProperty('--p', p);
      else new IntersectionObserver(function (en, io) { if (en[0].isIntersecting) { bar.style.setProperty('--p', Math.max(p, .02)); io.disconnect(); } }).observe(bar);
    }
    if (!done.length) return;
    var start = $('[data-guide-start]');
    if (start) {
      start.setAttribute('href', 'learn-ai.html' + q + '#m' + next);
      start.setAttribute('data-cta', 'guide_resume');
      $('span', start).textContent = AM.t('guide_resume', { n: next });
    }
    var nav = $('[data-guide-nav]');
    if (nav) { nav.textContent = AM.t('nav_guide_resume', { n: done.length }); nav.setAttribute('href', 'learn-ai.html' + q + '#m' + next); }
  })();

  /* ---------- Booking sheet: builds the WhatsApp message live ---------- */
  var dlg = d.getElementById('book-sheet');
  var form = d.getElementById('book-form');
  var preview = d.getElementById('sheet-preview');
  function openSheet(trigger) {
    if (!dlg || dlg.open || !dlg.showModal) return;
    dlg.showModal(); AM.overlay(true);
    AM.track('sheet_open', { trigger: trigger || '' });
    dlg.addEventListener('close', function onClose() { dlg.removeEventListener('close', onClose); AM.overlay(false); });
    update();
  }
  if (dlg && form) {
    var fName = d.getElementById('f_name'), fPhone = d.getElementById('f_phone'), fCountry = d.getElementById('f_country');
    var fEmail = d.getElementById('f_email'), fLoc = d.getElementById('f_location'), fTopic = d.getElementById('f_topic');
    var status = $('.form__status', form), started = false;
    [fName, fPhone, fEmail].forEach(function (el) {
      var label = $('.field__label', el.closest('.field'));
      if (label) label.insertAdjacentHTML('beforeend', '<svg class="icon field__ok" aria-hidden="true"><use href="#i-check"/></svg>');
    });
    var checked = function (name) { var el = $('[name="' + name + '"]:checked', form); return el ? el.value : ''; };
    var vars = function () {
      var ph = AM.phone.normalize(fPhone.value, fCountry.value);
      var lang = checked('lang'), size = checked('people');
      return {
        name: fName.value.trim(),
        phone: ph.ok ? ph.e164 : AM.digits(fPhone.value).trim(),
        email: AM.digits(fEmail.value).trim(),
        size: size ? AM.t('people_' + size) : '',
        city: fLoc.value.trim(),
        topic: fTopic.value ? fTopic.options[fTopic.selectedIndex].textContent.trim() : '',
        lang: lang ? AM.t('lang_' + lang) : ''
      };
    };
    var filled = function (v) { return Object.keys(v).filter(function (k) { return v[k]; }).length; };
    var fixText = function (n) { return n === 1 ? AM.t('fix_1') : n === 2 ? AM.t('fix_2') : AM.t('fix_n', { n: n }); };
    var mark = function (el, msg) {
      AM.setFieldError(el, msg);
      var f = el.closest('.field');
      if (f) f.classList.toggle('is-valid', !msg && !!el.value.trim());
    };
    var shake = function (el) {
      if (reduced) return;
      el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake');
      setTimeout(function () { el.classList.remove('is-shake'); }, 360);
    };
    var update = function () { if (preview) preview.textContent = AM.waText('proposal', vars()); };
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') mark(e.target, AM.validateField(e.target));
      update();
    });
    form.addEventListener('change', update);
    form.addEventListener('focusin', function () { if (!started) { started = true; AM.track('form_start', { form: 'proposal' }); } });
    form.addEventListener('focusout', function (e) {
      var el = e.target;
      if (!el.matches || !el.matches('input[type="text"], input[type="tel"], input[type="email"]')) return;
      if (el === fPhone && el.value) { var r = AM.phone.normalize(el.value, fCountry.value); if (r.ok) el.value = r.display; }
      if (el === fEmail) el.value = AM.digits(el.value).trim();
      if (el.value || el.required) mark(el, AM.validateField(el));
      update();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = [];
      [fName, fPhone, fEmail].forEach(function (el) {
        var msg = AM.validateField(el);
        mark(el, msg);
        if (msg) {
          bad.push(el); shake(el);
          AM.track('form_error', { form: 'proposal', field: el.getAttribute('data-track-field'), reason: el.value ? 'format' : 'empty' });
        }
      });
      if (bad.length) { status.textContent = fixText(bad.length); bad[0].focus(); return; }
      status.textContent = '';
      var v = vars();
      AM.waOpen('proposal', v, { section: 'sheet', sheet_fields_filled: filled(v), skipped_sheet: false });
      AM.toast(AM.t('sheet_sent'), { type: 'success' });
      dlg.close();
    });
    $('.sheet__skip', form).addEventListener('click', function () { setTimeout(function () { if (dlg.open) dlg.close(); }, 60); });
    update();
  }
  function update() { /* replaced above when the sheet exists */ }

  /* Sticky bar contexts that are not plain links: the sheet (#book) and kids WhatsApp (#wa-kids) */
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-cta-primary]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h === '#book') { e.preventDefault(); e.stopPropagation(); openSheet('sticky_primary'); }
    else if (h === '#wa-kids') { e.preventDefault(); e.stopPropagation(); AM.waOpen('kids', {}, { section: 'sticky' }); }
  }, true);
  if (location.hash === '#book') openSheet('hash');

  /* ---------- Header: sliding hover indicator under the nav ---------- */
  $$('[data-nav-ink]').forEach(function (list) {
    var ink = d.createElement('span'); ink.className = 'nav__ink'; ink.setAttribute('aria-hidden', 'true');
    list.appendChild(ink);
    var move = function (a) {
      var pad = 12;
      ink.style.setProperty('--x', (a.offsetLeft + a.parentElement.offsetLeft - list.offsetLeft + pad) + 'px');
      ink.style.setProperty('--w', Math.max(0, a.offsetWidth - pad * 2));
      list.classList.add('has-ink');
    };
    $$('a', list).forEach(function (a) {
      a.addEventListener('pointerenter', function () { move(a); });
      a.addEventListener('focus', function () { move(a); });
      a.addEventListener('blur', function () { list.classList.remove('has-ink'); });
    });
    list.addEventListener('pointerleave', function () { list.classList.remove('has-ink'); });
  });

  /* Theme toggle: spin the icons on change */
  d.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!t || reduced) return;
    t.classList.remove('is-spin'); void t.offsetWidth; t.classList.add('is-spin');
    setTimeout(function () { t.classList.remove('is-spin'); }, 420);
  });

  /* ---------- Ripple from the pointer on buttons ---------- */
  if (!reduced) {
    d.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('.btn');
      if (!b || b.disabled) return;
      var r = b.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
      var s = d.createElement('span'); s.className = 'ripple';
      s.style.width = s.style.height = size + 'px';
      s.style.left = (e.clientX - r.left - size / 2) + 'px';
      s.style.top = (e.clientY - r.top - size / 2) + 'px';
      b.appendChild(s);
      setTimeout(function () { s.remove(); }, 450);
    }, { passive: true });
  }

  /* ---------- Cursor-follow spotlight inside cards and rows ---------- */
  if (fine && !reduced) {
    d.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest('[data-spot]');
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------- Hero portrait: colour reveal through a moving circle, tilt, scan line ---------- */
  var photo = $('[data-hero-photo]');
  var frame = photo && $('.hero__frame', photo);
  if (frame && !reduced) {
    var scan = function () { frame.classList.remove('is-scan'); void frame.offsetWidth; frame.classList.add('is-scan'); };
    if (fine) {
      var pending = false, px = 0, py = 0;
      frame.addEventListener('pointerenter', function () { frame.classList.add('is-hot'); scan(); });
      frame.addEventListener('pointermove', function (e) {
        px = e.clientX; py = e.clientY;
        if (pending) return; pending = true;
        raf(function () {
          pending = false;
          var r = frame.getBoundingClientRect();
          var x = (px - r.left) / r.width, y = (py - r.top) / r.height;
          frame.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          frame.style.setProperty('--my', (y * 100).toFixed(1) + '%');
          frame.style.setProperty('--r', Math.round(Math.min(r.width, r.height) * .3) + 'px');
          frame.style.setProperty('--ry', ((x - .5) * 10).toFixed(2) + 'deg');   /* max ±5deg */
          frame.style.setProperty('--rx', ((.5 - y) * 8).toFixed(2) + 'deg');    /* max ±4deg */
        });
      });
      frame.addEventListener('pointerleave', function () {
        frame.classList.remove('is-hot');
        frame.style.setProperty('--rx', '0deg'); frame.style.setProperty('--ry', '0deg');
      });
    } else if ('IntersectionObserver' in window) {
      /* Touch: one reveal when the photo enters view, then back to monochrome */
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return; io.disconnect();
        frame.classList.add('is-reveal'); scan();
        setTimeout(function () { frame.classList.remove('is-reveal'); }, 1900);
      }, { threshold: .6 });
      io.observe(frame);
    }
  }

  /* ---------- H1: words lift slightly toward the cursor ---------- */
  var h1 = $('[data-words]');
  if (h1 && fine && !reduced) {
    var text = h1.textContent;
    h1.setAttribute('aria-label', text);
    h1.innerHTML = '';
    text.split(/(\s+)/).forEach(function (part) {
      if (/^\s+$/.test(part)) { h1.appendChild(d.createTextNode(part)); return; }
      var w = d.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true'); w.textContent = part; h1.appendChild(w);
    });
    var words = $$('.w', h1), wPending = false, wx = 0, wy = 0;
    var host = h1.closest('.hero') || h1;
    host.addEventListener('pointermove', function (e) {
      wx = e.clientX; wy = e.clientY;
      if (wPending) return; wPending = true;
      raf(function () {
        wPending = false;
        words.forEach(function (w) {
          var r = w.getBoundingClientRect();
          var dx = wx - (r.left + r.width / 2), dy = wy - (r.top + r.height / 2);
          var k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 220);
          w.style.transform = k ? 'translateY(' + (-k * 5).toFixed(2) + 'px)' : '';
        });
      });
    }, { passive: true });
    host.addEventListener('pointerleave', function () { words.forEach(function (w) { w.style.transform = ''; }); });
  }

  /* ---------- Band ticker wipes in once ---------- */
  var wipes = $$('[data-wipe]');
  if (wipes.length && !reduced && 'IntersectionObserver' in window) {
    root.classList.add('js-wipe');
    /* Observe the parent section: a fully clipped target never reports an intersection */
    var wio = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('[data-wipe]', e.target).forEach(function (el) { el.classList.add('is-in'); });
        wio.unobserve(e.target);
      });
    }, { threshold: .25 });
    wipes.forEach(function (el) {
      var host = el.closest('section') || el.parentElement;
      if (host.getBoundingClientRect().top < innerHeight * .75) el.classList.add('is-in'); else wio.observe(host);
    });
  }

  /* ---------- Scroll-linked: the timeline draws, the photo strip slides ---------- */
  var timeline = $('[data-timeline]');
  var strip = $('[data-hstrip]');
  var track = strip && $('.strip__track', strip);
  var wide = matchMedia('(min-width: 1024px)');
  var driven = false;
  function setDriven() {
    driven = !!(strip && track && wide.matches && fine && !reduced);
    if (strip) strip.classList.toggle('is-driven', driven);
    if (!driven && track) track.style.removeProperty('--tx');
  }
  setDriven();
  wide.addEventListener('change', function () { setDriven(); onScroll(); });
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    raf(function () {
      ticking = false;
      var vh = innerHeight;
      if (timeline && !reduced) {
        var r = timeline.getBoundingClientRect();
        var p = Math.min(1, Math.max(0, (vh * .85 - r.top) / (vh * .5)));
        timeline.style.setProperty('--draw', p.toFixed(3));
      }
      if (driven) {
        var sr = strip.getBoundingClientRect();
        var max = Math.max(0, track.scrollWidth - strip.clientWidth);
        var prog = Math.min(1, Math.max(0, (vh - sr.top) / (vh + sr.height)));
        var tx = max * prog * (rtl() ? 1 : -1);
        track.style.setProperty('--tx', tx.toFixed(1) + 'px');
      }
    });
  }
  if (timeline && reduced) timeline.style.setProperty('--draw', 1);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
});
