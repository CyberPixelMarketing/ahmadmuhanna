/* =====================================================================
   ahmadmuhanna.com · site.js  (vanilla, load with `defer`, no dependencies)

   Public API on window.AM. Page code that needs AM runs through the queue,
   which works whether it is placed before or after this file:
     (window.AMQ = window.AMQ || []).push(function (AM) { ... });
   or listen for:  document.addEventListener('am:ready', e => { const AM = e.detail; });

   Sections
   01 Core helpers         06 WhatsApp links      11 Session state
   02 UI strings + icons   07 Toasts              12 Testimonials
   03 i18n                 08 Copy to clipboard   13 Dialog sheet
   04 Header + menu        09 Phone + validation  14 Tracking
   05 Sticky CTA bar       10 Forms (FormSubmit)  15 Boot
   01b Theme (light/dark)
   ===================================================================== */
(function () {
  'use strict';

  var d = document;
  var root = d.documentElement;
  root.classList.add('js');

  var AM = window.AM = window.AM || {};
  AM.WA_NUMBER = '971522346020';
  AM.FORM_ENDPOINT = 'https://formsubmit.co/ajax/ahmadmuhanna@gmail.com';

  /* ---------- 01 Core helpers ---------- */
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  AM.$ = $; AM.$$ = $$;

  AM.store = {
    get: function (k, session) { try { return (session ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set: function (k, v, session) { try { (session ? sessionStorage : localStorage).setItem(k, v); } catch (e) { /* private mode */ } },
    remove: function (k, session) { try { (session ? sessionStorage : localStorage).removeItem(k); } catch (e) { } }
  };

  AM.isTouch = function () { return matchMedia('(pointer: coarse)').matches; };
  AM.reducedMotion = function () {
    return matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('reduce-motion');
  };

  /* Page globals. Works with `const CONFIG = {...}` in a classic page script
     (shared global lexical scope) and with window.CONFIG. */
  AM.config = function () {
    /* global CONFIG */
    var c = (typeof CONFIG !== 'undefined') ? CONFIG : window.CONFIG;
    return c || {};
  };
  AM.content = function () {
    /* global CONTENT */
    var c = (typeof CONTENT !== 'undefined') ? CONTENT : window.CONTENT;
    return c || { ar: {}, en: {} };
  };

  function fill(str, vars) {
    vars = vars || {};
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars[k] !== undefined && vars[k] !== null && vars[k] !== '') ? String(vars[k]) : m;
    });
  }
  AM.fill = fill;

  /* Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII */
  AM.digits = function (s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); });
  };

  function emit(name, detail) { d.dispatchEvent(new CustomEvent(name, { detail: detail })); }
  AM.emit = emit;

  /* Overlay counter: menu, dialog. CTA bar hides and Lenis stops while > 0. */
  var overlays = 0;
  AM.overlay = function (open) {
    overlays = Math.max(0, overlays + (open ? 1 : -1));
    root.classList.toggle('is-locked', overlays > 0);
    emit('am:overlay', { open: overlays > 0 });
  };
  AM.overlayOpen = function () { return overlays > 0; };

  /* ---------- 01b Theme (light / dark) ----------
     Resolution: stored choice (localStorage 'am-theme') > OS preference.
     Applied as <html data-theme="light|dark">; the <head> boot snippet does the
     same before first paint (DESIGN.md "Themes"), this repeats it for pages
     without the snippet. Colours live in CSS tokens only.
       AM.theme.get()            -> 'light' | 'dark' (what is applied now)
       AM.theme.set('light'|'dark'|'system')  'system' clears the stored choice
       AM.theme.toggle()         -> the new theme (and stores it)
       AM.theme.stored()         -> 'light' | 'dark' | null
       AM.theme.system()         -> 'light' | 'dark'
     Every change dispatches `am:themechange` on document with
     detail { theme, previous, source: 'init'|'user'|'system', stored }. */
  var THEME_KEY = 'am-theme';
  var mqLight = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  function validTheme(v) { return v === 'light' || v === 'dark' ? v : null; }
  function storedTheme() { try { return validTheme(localStorage.getItem(THEME_KEY)); } catch (e) { return null; } }
  function systemTheme() { return mqLight && mqLight.matches ? 'light' : 'dark'; }
  var themeAnimTimer = 0;

  function paintThemeControls(theme) {
    var label = (UI[AM.lang] || UI.ar).theme_label;
    $$('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(theme === 'light'));
      var vis = $('.theme-toggle__label', b);
      if (vis) { vis.textContent = label; b.removeAttribute('aria-label'); }
      else b.setAttribute('aria-label', label);
    });
    /* Browser chrome colour follows the page surface token */
    var bg = getComputedStyle(root).getPropertyValue('--c-bg').trim();
    if (bg) {
      var metas = $$('meta[name="theme-color"]');
      if (!metas.length) { var m = d.createElement('meta'); m.name = 'theme-color'; d.head.appendChild(m); metas = [m]; }
      metas.forEach(function (m) { m.removeAttribute('media'); m.setAttribute('content', bg); });
    }
  }
  function applyTheme(theme, source) {
    var prev = validTheme(root.getAttribute('data-theme'));
    var animate = source === 'user' && prev && prev !== theme && !AM.reducedMotion();
    if (animate) {
      root.classList.add('theme-anim');
      clearTimeout(themeAnimTimer);
      themeAnimTimer = setTimeout(function () { root.classList.remove('theme-anim'); }, 220);
    }
    root.setAttribute('data-theme', theme);
    paintThemeControls(theme);
    if (prev !== theme || source === 'init') {
      emit('am:themechange', { theme: theme, previous: prev, source: source, stored: storedTheme() });
    }
    return theme;
  }
  AM.theme = {
    key: THEME_KEY,
    get: function () { return validTheme(root.getAttribute('data-theme')) || storedTheme() || systemTheme(); },
    stored: storedTheme,
    system: systemTheme,
    set: function (theme) {
      if (theme === 'system' || theme === null) {
        try { localStorage.removeItem(THEME_KEY); } catch (e) { }
        return applyTheme(systemTheme(), 'user');
      }
      theme = validTheme(theme);
      if (!theme) return AM.theme.get();
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode: still applies */ }
      AM.track('theme_switch', { to: theme });
      return applyTheme(theme, 'user');
    },
    toggle: function () { return AM.theme.set(AM.theme.get() === 'light' ? 'dark' : 'light'); },
    refresh: function () { paintThemeControls(AM.theme.get()); }
  };
  /* Apply now (deferred script; the boot snippet normally did this already) */
  root.setAttribute('data-theme', storedTheme() || validTheme(root.getAttribute('data-theme')) || systemTheme());
  /* Follow the OS while the visitor has not chosen */
  if (mqLight) {
    var onSystem = function () { if (!storedTheme()) applyTheme(systemTheme(), 'system'); };
    if (mqLight.addEventListener) mqLight.addEventListener('change', onSystem); else if (mqLight.addListener) mqLight.addListener(onSystem);
  }
  /* Another tab changed the choice */
  window.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY) applyTheme(validTheme(e.newValue) || systemTheme(), 'system');
  });
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!b) return;
    e.preventDefault();
    AM.theme.toggle();
  });

  /* ---------- 02 UI strings + icons ---------- */
  /* Defaults for shared UI. A page can override any key in CONTENT[lang]. */
  var UI = {
    ar: {
      err_required: 'هذا الحقل مطلوب.',
      err_name: 'اكتب اسمك.',
      err_email: 'اكتب بريداً إلكترونياً صحيحاً، مثل name@gmail.com',
      err_phone_ae: 'أدخل رقم موبايل إماراتياً مثل 050 123 4567',
      err_phone_8: 'أدخل رقماً من 8 أرقام بدون رمز الدولة.',
      err_phone_sa: 'أدخل رقم موبايل سعودياً مثل 050 123 4567',
      err_phone_other: 'اكتب الرقم مع رمز الدولة، مثل 971501234567',
      did_you_mean: 'هل تقصد {email}؟',
      sending: 'جارٍ الإرسال…',
      wa_opens: '(يفتح واتساب)',
      copied: 'تم النسخ',
      copied_toast: 'تم النسخ إلى الحافظة.',
      copy_failed: 'تعذّر النسخ. حدّد النص وانسخه يدوياً.',
      form_fail: 'تعذّر الإرسال. حاول مرة أخرى، أو أرسل بياناتك على واتساب.',
      form_fail_btn: 'أرسل بياناتي على واتساب',
      toast_close: 'إغلاق التنبيه',
      menu_open: 'فتح القائمة',
      menu_close: 'إغلاق القائمة',
      lang_label: 'English',
      lang_aria: 'Switch to English',
      demo_typing: 'يكتب',
      demo_ready: 'جاهز',
      demo_answer: 'الإجابة',
      demo_replay: 'أعد العرض',
      demo_show_all: 'اعرض كاملاً',
      marquee_pause: 'إيقاف الحركة',
      marquee_play: 'تشغيل الحركة',
      theme_label: 'الوضع الفاتح'
    },
    en: {
      err_required: 'This field is required.',
      err_name: 'Enter your name.',
      err_email: 'Enter a valid email, like name@gmail.com',
      err_phone_ae: 'Enter a UAE mobile like 050 123 4567',
      err_phone_8: 'Enter an 8-digit number without the country code.',
      err_phone_sa: 'Enter a Saudi mobile like 050 123 4567',
      err_phone_other: 'Include the country code, like 971501234567',
      did_you_mean: 'Did you mean {email}?',
      sending: 'Sending…',
      wa_opens: '(opens WhatsApp)',
      copied: 'Copied',
      copied_toast: 'Copied to clipboard.',
      copy_failed: 'Couldn’t copy. Select the text and copy it manually.',
      form_fail: 'Couldn’t send. Try again, or send your details on WhatsApp.',
      form_fail_btn: 'Send my details on WhatsApp',
      toast_close: 'Dismiss',
      menu_open: 'Open menu',
      menu_close: 'Close menu',
      lang_label: 'عربي',
      lang_aria: 'التبديل إلى العربية',
      demo_typing: 'typing',
      demo_ready: 'ready',
      demo_answer: 'answer',
      demo_replay: 'Replay',
      demo_show_all: 'Show full',
      marquee_pause: 'Pause motion',
      marquee_play: 'Play motion',
      theme_label: 'Light mode'
    }
  };
  AM.UI = UI;

  /* "Please fix N fields" with Arabic plural forms */
  function fixFieldsText(n) {
    if (AM.lang === 'en') return n === 1 ? 'Please fix 1 field.' : 'Please fix ' + n + ' fields.';
    var cat = 'other';
    try { cat = new Intl.PluralRules('ar').select(n); } catch (e) { }
    if (cat === 'one') return 'يرجى تصحيح حقل واحد.';
    if (cat === 'two') return 'يرجى تصحيح حقلين.';
    if (cat === 'few') return 'يرجى تصحيح ' + n + ' حقول.';
    return 'يرجى تصحيح ' + n + ' حقلاً.';
  }

  /* Lucide-style icons (24 grid, stroke). WhatsApp is the brand glyph (filled). */
  var ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    replay: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    whatsapp: '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z"/>'
  };
  AM.icon = function (name, cls) {
    var fillIcon = name === 'whatsapp' || name === 'play';
    return '<svg class="icon' + (fillIcon ? ' icon--fill' : '') + (cls ? ' ' + cls : '') +
      '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  };

  /* ---------- 03 i18n ---------- */
  /* Keeps the per-page pattern: CONFIG + CONTENT {ar, en}. ?lang=en wins,
     then the stored choice (am_lang), then Arabic. */
  function detectLang() {
    var p = new URLSearchParams(location.search).get('lang');
    if (p === 'en' || p === 'ar') { AM.store.set('am_lang', p); return p; }
    var s = AM.store.get('am_lang');
    return (s === 'en' || s === 'ar') ? s : 'ar';
  }
  AM.lang = detectLang();

  /* t(key, vars): CONTENT[lang][key], then UI defaults, else '' */
  AM.t = function (key, vars) {
    var C = AM.content();
    var v = (C[AM.lang] || {})[key];
    if (v === undefined) v = (UI[AM.lang] || {})[key];
    if (v === undefined || v === null) return '';
    return (typeof v === 'string' && vars) ? fill(v, vars) : v;
  };

  /* Builds the URL of this page in the other language */
  AM.langHref = function (to) {
    var u = new URL(location.href);
    if (to === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.set('lang', 'ar');
    return u.pathname + u.search + u.hash;
  };

  function isInternal(a) {
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:|https?:\/\/wa\.me)/i.test(href)) return false;
    if (a.hasAttribute('data-no-lang') || a.hasAttribute('data-lang-switch') || a.hasAttribute('download')) return false;
    try {
      var u = new URL(href, location.href);
      return u.origin === location.origin && (/\.html?$/.test(u.pathname) || /\/[^.]*$/.test(u.pathname));
    } catch (e) { return false; }
  }

  AM.applyLang = function (lang) {
    if (lang) AM.lang = lang;
    var t = AM.content()[AM.lang] || {};
    var dir = t.dir || (AM.lang === 'ar' ? 'rtl' : 'ltr');
    root.lang = AM.lang;
    root.dir = dir;
    if (t.pageTitle) d.title = t.pageTitle;
    if (t.metaDesc) { var md = $('meta[name="description"]'); if (md) md.setAttribute('content', t.metaDesc); }

    /* Page CONTENT first, then the shared UI defaults (demo_replay, …) */
    var ui = UI[AM.lang] || {};
    var pick = function (k) { return t[k] !== undefined ? t[k] : ui[k]; };
    $$('[data-i18n]').forEach(function (el) {
      var v = pick(el.getAttribute('data-i18n')); if (typeof v === 'string') el.textContent = v;
    });
    $$('[data-i18n-html]').forEach(function (el) {
      var v = pick(el.getAttribute('data-i18n-html')); if (typeof v === 'string') el.innerHTML = v;
    });
    /* data-i18n-attr="placeholder:key; aria-label:key2" */
    $$('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var bits = pair.split(':'); if (bits.length < 2) return;
        var attr = bits[0].trim(), v = pick(bits.slice(1).join(':').trim());
        if (attr && typeof v === 'string') el.setAttribute(attr, v);
      });
    });

    /* Language switch links */
    var to = AM.lang === 'ar' ? 'en' : 'ar';
    $$('[data-lang-switch]').forEach(function (a) {
      a.setAttribute('href', AM.langHref(to));
      a.setAttribute('hreflang', to);
      a.setAttribute('lang', to);
      a.setAttribute('aria-label', UI[AM.lang].lang_aria);
      if (!a.hasAttribute('data-keep-label')) a.textContent = UI[AM.lang].lang_label;
    });

    /* Internal links carry the language. Only the query string changes; the
       path is kept exactly as written (relative links stay relative). */
    $$('a[href]').forEach(function (a) {
      if (!isInternal(a)) return;
      var href = a.getAttribute('href');
      var hashAt = href.indexOf('#');
      var hash = hashAt > -1 ? href.slice(hashAt) : '';
      var rest = hashAt > -1 ? href.slice(0, hashAt) : href;
      var qAt = rest.indexOf('?');
      var path = qAt > -1 ? rest.slice(0, qAt) : rest;
      var params = new URLSearchParams(qAt > -1 ? rest.slice(qAt + 1) : '');
      if (AM.lang === 'en') params.set('lang', 'en'); else params.delete('lang');
      var qs = params.toString();
      a.setAttribute('href', path + (qs ? '?' + qs : '') + hash);
    });

    refreshWaLinks();
    emit('am:lang', { lang: AM.lang, t: t });
  };

  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-lang-switch]');
    if (!a) return;
    var to = a.getAttribute('hreflang') || (AM.lang === 'ar' ? 'en' : 'ar');
    AM.store.set('am_lang', to);
    AM.track('lang_switch', { to: to });
  });

  /* ---------- 04 Header + menu ---------- */
  function initHeader() {
    var header = $('.site-header');
    if (!header) return;

    /* Optional hide-on-scroll-down / show-on-scroll-up: opt in with data-autohide.
       Default is a static opaque header (ux-strategy 3.3, ai-slop D6). */
    if (header.hasAttribute('data-autohide')) {
      var lastY = window.scrollY, ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return; ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY, delta = y - lastY;
          if (Math.abs(delta) > 6) {
            var hide = delta > 0 && y > header.offsetHeight * 2 && !AM.overlayOpen() && !header.contains(d.activeElement);
            header.classList.toggle('is-hidden', hide);
            lastY = y;
          }
          ticking = false;
        });
      }, { passive: true });
      header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    }

    /* Desktop header CTA yields while the hero CTA is visible */
    var cta = $('.site-header__cta[data-yield]');
    var hero = $('[data-hero-cta]');
    if (cta) {
      if (hero && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          var e = en[0];
          cta.classList.toggle('is-shown', !e.isIntersecting && e.boundingClientRect.top < 0);
        }).observe(hero);
      } else cta.classList.add('is-shown');
    }

    /* Mobile menu: [data-menu-toggle][aria-controls=menu id] */
    var toggle = $('[data-menu-toggle]');
    var menu = toggle && d.getElementById(toggle.getAttribute('aria-controls'));
    if (!toggle || !menu) return;
    var open = false;

    function focusables() {
      return [toggle].concat($$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', menu));
    }
    function setOpen(next, restoreFocus) {
      if (next === open) return;
      open = next;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', UI[AM.lang][open ? 'menu_close' : 'menu_open']);
      menu.classList.toggle('is-open', open);
      AM.overlay(open);
      if (open) {
        header.classList.remove('is-hidden');
        var first = $('a[href], button', menu);
        setTimeout(function () { if (first) first.focus(); }, 30);
      } else if (restoreFocus !== false) toggle.focus();
    }
    AM.closeMenu = function () { setOpen(false, false); };
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', UI[AM.lang].menu_open);
    toggle.addEventListener('click', function () { setOpen(!open); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false, false); });
    d.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(); if (!f.length) return;
      var i = f.indexOf(d.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) setOpen(false, false); });
  }

  /* ---------- 05 Sticky mobile CTA bar ---------- */
  /* Markup:
     <div class="cta-bar" data-cta-bar>
       <a class="btn btn--primary cta-bar__primary" data-cta-primary href="free-workshop.html#register"><span class="btn__label">…</span></a>
       <a class="btn btn--wa btn--icon cta-bar__wa" data-wa="general" href="https://wa.me/971522346020">(svg)</a>
     </div>
     Shows once [data-hero-cta] has scrolled above the viewport. Hides while any
     [data-cta-bar-hide] element (form, final CTA) or the footer covers >=30% of the
     viewport, while an input is focused, and while the menu/dialog is open.
     Sections with data-cta-context swap the bar at >=50%:
       data-cta-label-key="proposal" data-cta-href="#teams" data-cta-wa="proposal" */
  function initCtaBar() {
    var bar = $('[data-cta-bar]');
    if (!bar || !('IntersectionObserver' in window)) return;
    root.classList.add('has-cta-bar');
    var primary = $('[data-cta-primary]', bar);
    var label = primary && ($('.btn__label', primary) || primary);
    var wa = $('.cta-bar__wa', bar);
    var base = {
      labelKey: primary && primary.getAttribute('data-i18n-key'),
      label: label ? label.textContent : '',
      href: primary ? primary.getAttribute('href') : '',
      wa: wa ? wa.getAttribute('data-wa') : 'general',
      track: primary ? primary.getAttribute('data-cta') : ''
    };
    var heroCta = $('[data-hero-cta]');
    var pastHero = !heroCta;
    var hiders = new Set();
    var typing = false;
    var contexts = new Map();
    var current = null;
    var steps = []; for (var i = 0; i <= 20; i++) steps.push(i / 20);

    function covers(e, ratio) {
      return e.isIntersecting && (e.intersectionRatio >= ratio || e.intersectionRect.height >= window.innerHeight * ratio);
    }
    function update() {
      var show = pastHero && hiders.size === 0 && !typing && !AM.overlayOpen();
      bar.classList.toggle('is-visible', show);
      root.classList.toggle('cta-bar-on', show);
    }
    function applyContext(el) {
      if (el === current) return;
      current = el;
      var next = el ? {
        labelKey: el.getAttribute('data-cta-label-key'),
        label: el.getAttribute('data-cta-label'),
        href: el.getAttribute('data-cta-href'),
        wa: el.getAttribute('data-cta-wa'),
        track: el.getAttribute('data-cta-track')
      } : base;
      var swap = function () {
        if (primary) {
          var text = next.labelKey ? AM.t(next.labelKey) : next.label;
          if (text && label) label.textContent = text;
          if (next.href) primary.setAttribute('href', next.href);
          primary.setAttribute('data-cta', next.track || base.track || 'sticky_primary');
        }
        if (wa && next.wa) { wa.setAttribute('data-wa', next.wa); refreshWaLinks(wa); }
        bar.classList.remove('is-swapping');
      };
      if (AM.reducedMotion()) { swap(); return; }
      bar.classList.add('is-swapping');
      setTimeout(swap, 150);
    }

    if (heroCta) {
      new IntersectionObserver(function (en) {
        var e = en[0];
        pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
        update();
      }).observe(heroCta);
    }
    var hideIO = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (covers(e, 0.3)) hiders.add(e.target); else hiders.delete(e.target); });
      update();
    }, { threshold: steps });
    $$('[data-cta-bar-hide], .site-footer').forEach(function (el) { hideIO.observe(el); });

    var ctxIO = new IntersectionObserver(function (en) {
      en.forEach(function (e) { contexts.set(e.target, covers(e, 0.5)); });
      var winner = null;
      contexts.forEach(function (on, el) { if (on) winner = el; });
      applyContext(winner);
    }, { threshold: steps });
    $$('[data-cta-context]').forEach(function (el) { ctxIO.observe(el); });

    d.addEventListener('focusin', function (e) {
      if (e.target.matches && e.target.matches('input, textarea, select')) { typing = true; update(); }
    });
    d.addEventListener('focusout', function (e) {
      if (e.target.matches && e.target.matches('input, textarea, select')) { typing = false; setTimeout(update, 50); }
    });
    d.addEventListener('am:overlay', update);
    AM.ctaBar = { update: update, setContext: applyContext };
    update();
  }

  /* ---------- 06 WhatsApp links ---------- */
  /* Templates from ux-strategy 5.4 and 7.3. Pages may override any template with
     CONTENT[lang].wa_<key>. `____` lines are deliberate blanks for the visitor. */
  var WA = {
    ar: {
      general: 'مرحباً أحمد، وصلت من موقعك ولدي سؤال عن التدريب:\n____',
      proposal: 'مرحباً أحمد، أرغب بعرض سعر لتدريب فريقنا على الذكاء الاصطناعي.\nالجهة: {company}\nعدد المشاركين: {size}\nالشكل: {format}، {city}\nاللغة: {lang}\nالموضوع: {topic}\nالاسم: {name}',
      proposal_ws: 'مرحباً أحمد، أرغب بعرض لورشة «{workshop}» لفريقنا.\nعدد المشاركين: ____\nحضوري أم أونلاين: ____',
      kids: 'مرحباً أحمد، أسأل عن ورشة الذكاء الاصطناعي للأطفال.\nالعمر: ____\nالمدينة: ____\nأنا: ولي أمر / مدرسة / مخيم',
      waitlist_q: 'مرحباً أحمد، عندي سؤال عن الورشة الأونلاين «الذكاء الاصطناعي لعملك بأقل عدد من التطبيقات»:\n____',
      paid_q: 'مرحباً أحمد، عندي سؤال قبل الدفع لورشة {date}:\n____',
      receipt: 'مرحباً أحمد، دفعت رسوم ورشة {date} (50 درهماً) عبر Ziina.\nالاسم الكامل: ____\nأرفقت صورة الإيصال.',
      guide_q: 'مرحباً أحمد، أقرأ دليل «مدخل إلى الذكاء الاصطناعي» (المحور {n}) وعندي سؤال:\n____',
      form_fail: 'مرحباً أحمد، حاولت التسجيل في قائمة انتظار الورشة ولم يعمل النموذج.\nالاسم: {name}\nالإيميل: {email}',
      share_module: 'شرح مبسّط بالعربي عن {title} من أحمد مهنا، مجاني وبدون تسجيل:\nhttps://ahmadmuhanna.com/learn-ai?utm_source=whatsapp&utm_medium=share&utm_content=m{n}#m{n}',
      share_prompt: 'جرّب هذا الطلب، بنيته بطريقة العناصر الأربعة:\n{prompt}\n\nالأداة مجانية: https://ahmadmuhanna.com/learn-ai?utm_source=whatsapp&utm_medium=share&utm_content=builder#builder',
      share_guide: 'أنهيت دليل «مدخل إلى الذكاء الاصطناعي» بالعربي، 9 محاور في 20 دقيقة تقريباً:\nhttps://ahmadmuhanna.com/learn-ai?utm_source=whatsapp&utm_medium=share&utm_content=guide',
      share_ws: 'سجّلت في قائمة انتظار ورشة «الذكاء الاصطناعي لعملك بأقل عدد من التطبيقات» مع أحمد مهنا، إذا يهمك:\nhttps://ahmadmuhanna.com/free-workshop?utm_source=whatsapp&utm_medium=share&utm_content=waitlist'
    },
    en: {
      general: 'Hi Ahmad, I found you through your website and have a question about training:\n____',
      proposal: 'Hi Ahmad, I’d like a proposal for AI training for our team.\nOrganisation: {company}\nParticipants: {size}\nFormat: {format}, {city}\nLanguage: {lang}\nTopic: {topic}\nName: {name}',
      proposal_ws: 'Hi Ahmad, I’d like a proposal for the "{workshop}" workshop for our team.\nParticipants: ____\nOn-site or online: ____',
      kids: 'Hi Ahmad, I’m asking about the Kids AI workshop.\nAge(s): ____\nCity: ____\nI’m a: parent / school / camp',
      waitlist_q: 'Hi Ahmad, I have a question about the online workshop "AI for your business, with fewer apps":\n____',
      paid_q: 'Hi Ahmad, a question before I pay for the {date} workshop:\n____',
      receipt: 'Hi Ahmad, I’ve paid the AED 50 fee for the {date} workshop via Ziina.\nFull name: ____\nReceipt screenshot attached.',
      guide_q: 'Hi Ahmad, I’m reading the "Introduction to AI" guide (module {n}) and have a question:\n____',
      form_fail: 'Hi Ahmad, I tried to join the workshop waitlist but the form didn’t go through.\nName: {name}\nEmail: {email}',
      share_module: 'A clear, free explainer on {title} by Ahmad Muhanna, no sign-up:\nhttps://ahmadmuhanna.com/learn-ai?lang=en&utm_source=whatsapp&utm_medium=share&utm_content=m{n}#m{n}',
      share_prompt: 'Try this prompt, built with the four-part method:\n{prompt}\n\nThe builder is free: https://ahmadmuhanna.com/learn-ai?lang=en&utm_source=whatsapp&utm_medium=share&utm_content=builder#builder',
      share_guide: 'I finished the "Introduction to AI" guide, 9 modules in about 20 minutes:\nhttps://ahmadmuhanna.com/learn-ai?lang=en&utm_source=whatsapp&utm_medium=share&utm_content=guide',
      share_ws: 'I joined the waitlist for Ahmad Muhanna’s online workshop "AI for your business, with fewer apps", in case it’s useful:\nhttps://ahmadmuhanna.com/free-workshop?lang=en&utm_source=whatsapp&utm_medium=share&utm_content=waitlist'
    }
  };
  AM.WA_TEMPLATES = WA;

  /* waText(key, vars): fills {vars}; a line whose variable stayed empty is dropped
     (so a half-filled proposal sheet sends a clean message). */
  AM.waText = function (key, vars) {
    var override = (AM.content()[AM.lang] || {})['wa_' + key];
    var tpl = override !== undefined ? override : ((WA[AM.lang] || WA.ar)[key] || WA[AM.lang].general);
    var out = fill(tpl, vars || {});
    return out.split('\n').filter(function (line) { return !/\{\w+\}/.test(line); })
      .join('\n').replace(/،\s*$/gm, '').replace(/,\s*$/gm, '').trim();
  };
  /* waLink(templateKey, vars) -> https://wa.me/971522346020?text=...
     share_* keys use wa.me/?text= so the visitor picks the contact. */
  AM.waLink = function (key, vars) {
    var base = /^share_/.test(key) ? 'https://wa.me/' : 'https://wa.me/' + AM.WA_NUMBER;
    return base + '?text=' + encodeURIComponent(AM.waText(key, vars));
  };
  /* waOpen: tracks, then location.href on touch (in-app browsers mishandle
     _blank for wa.me), window.open on desktop. */
  AM.waOpen = function (key, vars, props) {
    var url = AM.waLink(key, vars);
    AM.track('wa_open', Object.assign({ context: key }, props || {}));
    if (AM.isTouch()) { location.href = url; return; }
    var w = window.open(url, '_blank', 'noopener');
    if (!w) location.href = url;
  };

  function waVars(el) {
    var raw = el.getAttribute('data-wa-vars');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) { return {}; }
  }
  /* [data-wa="key"] (+ optional data-wa-vars='{"workshop":"…"}'). The HTML href
     should already be a plain https://wa.me/971522346020 fallback for no-JS. */
  function refreshWaLinks(scope) {
    var list = scope && scope.nodeType === 1 && scope.hasAttribute('data-wa') ? [scope] : $$('[data-wa]');
    list.forEach(function (el) {
      var key = el.getAttribute('data-wa') || 'general';
      if (el.tagName === 'A') el.setAttribute('href', AM.waLink(key, waVars(el)));
      var suffix = UI[AM.lang].wa_opens;
      var base = el.getAttribute('data-wa-label') || el.textContent.trim() || el.getAttribute('aria-label') || '';
      base = base.replace(/\s*\((يفتح واتساب|opens WhatsApp)\)\s*$/, '');
      if (base) el.setAttribute('aria-label', base + ' ' + suffix);
    });
  }
  AM.refreshWaLinks = refreshWaLinks;

  d.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-wa]');
    if (!el || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    AM.waOpen(el.getAttribute('data-wa') || 'general', waVars(el), {
      section: el.getAttribute('data-section') || (el.closest('[id]') || {}).id || ''
    });
  });

  /* ---------- 07 Toasts ---------- */
  /* AM.toast(message, { type: 'info'|'success'|'error', timeout: ms }) */
  var toastRegion = null;
  AM.toast = function (message, opts) {
    opts = opts || {};
    var type = opts.type || 'info';
    if (!toastRegion) {
      toastRegion = d.createElement('div');
      toastRegion.className = 'toast-region';
      toastRegion.setAttribute('aria-live', 'polite');
      toastRegion.setAttribute('aria-atomic', 'false');
      d.body.appendChild(toastRegion);
    }
    while (toastRegion.children.length >= 3) toastRegion.firstElementChild.remove();
    var el = d.createElement('div');
    el.className = 'toast toast--' + type;
    if (type === 'error') el.setAttribute('role', 'alert');
    el.innerHTML = AM.icon(type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info', 'toast__icon') +
      '<p class="toast__msg"></p><button type="button" class="toast__close">' + AM.icon('x') + '</button>';
    $('.toast__msg', el).textContent = message;
    var close = $('.toast__close', el);
    close.setAttribute('aria-label', UI[AM.lang].toast_close);
    var timer;
    function dismiss() {
      clearTimeout(timer);
      if (AM.reducedMotion()) { el.remove(); return; }
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 200);
    }
    close.addEventListener('click', dismiss);
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, 2500); });
    toastRegion.appendChild(el);
    var ms = opts.timeout === 0 ? 0 : (opts.timeout || (type === 'error' ? 7000 : 4000));
    if (ms) timer = setTimeout(dismiss, ms);
    return { el: el, dismiss: dismiss };
  };

  /* ---------- 08 Copy to clipboard ---------- */
  AM.copy = function (text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = d.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      d.body.appendChild(ta); ta.select();
      try { d.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
      ta.remove();
    });
  };
  /* <button class="copy-btn" data-copy-target="#prompt-1"> or data-copy="literal text".
     Label lives in .copy-btn__label; it swaps to "Copied" for 1.5s and a toast confirms. */
  d.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy], [data-copy-target]');
    if (!btn) return;
    e.preventDefault();
    var text = btn.getAttribute('data-copy');
    if (!text) {
      var target = $(btn.getAttribute('data-copy-target'));
      text = target ? (target.value !== undefined && target.tagName !== 'DIV' && target.tagName !== 'PRE' ? target.value : target.innerText) : '';
    }
    if (!text) return;
    AM.copy(text.trim()).then(function () {
      var lab = $('.copy-btn__label', btn);
      var prev = lab ? lab.textContent : null;
      var iconEl = $('svg', btn), prevIcon = iconEl ? iconEl.outerHTML : null;
      btn.classList.add('is-done');
      if (lab) lab.textContent = UI[AM.lang].copied;
      if (iconEl) iconEl.outerHTML = AM.icon('check');
      AM.toast(UI[AM.lang].copied_toast, { type: 'success', timeout: 2500 });
      AM.track('copy', { source: btn.getAttribute('data-copy-source') || 'block' });
      setTimeout(function () {
        btn.classList.remove('is-done');
        if (lab && prev !== null) lab.textContent = prev;
        var now = $('svg', btn); if (now && prevIcon) now.outerHTML = prevIcon;
      }, 1500);
    }, function () { AM.toast(UI[AM.lang].copy_failed, { type: 'error' }); });
  });

  /* ---------- 09 Phone + validation ---------- */
  var COUNTRIES = {
    AE: { code: '971', re: /^5\d{8}$/, err: 'err_phone_ae', group: [2, 3, 4] },
    SA: { code: '966', re: /^5\d{8}$/, err: 'err_phone_sa', group: [2, 3, 4] },
    QA: { code: '974', re: /^\d{8}$/, err: 'err_phone_8', group: [4, 4] },
    KW: { code: '965', re: /^\d{8}$/, err: 'err_phone_8', group: [4, 4] },
    BH: { code: '973', re: /^\d{8}$/, err: 'err_phone_8', group: [4, 4] },
    OM: { code: '968', re: /^\d{8}$/, err: 'err_phone_8', group: [4, 4] },
    XX: { code: '', re: /^\d{8,15}$/, err: 'err_phone_other', group: null }
  };
  /* AM.phone.normalize('050 123 4567', 'AE') ->
     { ok, iso, e164: '+971501234567', national: '501234567', display: '50 123 4567' } */
  AM.phone = {
    countries: COUNTRIES,
    normalize: function (raw, iso) {
      iso = COUNTRIES[iso] ? iso : 'AE';
      var s = AM.digits(raw).replace(/[\s\-().‎‏]/g, '');
      var intl = /^(\+|00)/.test(s);
      s = s.replace(/^\+/, '').replace(/^00/, '');
      /* A pasted international prefix selects its country */
      var detected = null;
      Object.keys(COUNTRIES).forEach(function (k) {
        var c = COUNTRIES[k].code;
        if (c && s.indexOf(c) === 0 && (intl || s.length > 10)) detected = k;
      });
      if (detected) { iso = detected; s = s.slice(COUNTRIES[iso].code.length); }
      var c = COUNTRIES[iso];
      if (iso !== 'XX') s = s.replace(/^0+/, '');
      var ok = c.re.test(s);
      var display = s;
      if (ok && c.group) {
        var parts = [], i = 0;
        c.group.forEach(function (n) { parts.push(s.substr(i, n)); i += n; });
        display = parts.join(' ');
      }
      return { ok: ok, iso: iso, national: s, e164: ok ? '+' + (c.code || '') + s : '', display: display, err: c.err };
    }
  };

  var TYPO_DOMAINS = {
    'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmai.com': 'gmail.com',
    'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com',
    'hotmail.con': 'hotmail.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
    'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'icloud.con': 'icloud.com'
  };
  AM.emailSuggestion = function (email) {
    var m = /^([^@\s]+)@([^@\s]+)$/.exec(email || '');
    if (!m) return '';
    var fix = TYPO_DOMAINS[m[2].toLowerCase()];
    return fix ? m[1] + '@' + fix : '';
  };

  function fieldWrap(el) { return el.closest('.field') || el.parentElement; }
  function errorEl(el, create) {
    var wrap = fieldWrap(el);
    var id = (el.id || el.name || 'f' + Math.random().toString(36).slice(2, 7)) + '-error';
    var err = d.getElementById(id);
    if (!err && create) {
      err = d.createElement('p');
      err.className = 'field__error'; err.id = id; err.hidden = true;
      wrap.appendChild(err);
    }
    return err;
  }
  function describe(el, id, on) {
    var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    var has = ids.indexOf(id) > -1;
    if (on && !has) ids.push(id);
    if (!on && has) ids.splice(ids.indexOf(id), 1);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
  }
  function setError(el, msg) {
    var err = errorEl(el, !!msg);
    if (msg) {
      err.innerHTML = AM.icon('alert') + '<span></span>';
      err.lastChild.textContent = msg;
      err.hidden = false;
      el.setAttribute('aria-invalid', 'true');
      describe(el, err.id, true);
    } else {
      el.removeAttribute('aria-invalid');
      if (err) { err.hidden = true; describe(el, err.id, false); }
    }
  }
  AM.setFieldError = setError;

  function phoneSelect(el) {
    var sel = el.getAttribute('data-phone-country');
    return sel ? $(sel) : $('select', el.closest('.phone') || fieldWrap(el));
  }

  /* Returns '' when valid, otherwise the error message. Rules:
     required · type=email · data-phone (UAE-first) · minlength · data-error-<rule>="CONTENT key" */
  AM.validateField = function (el) {
    if (el.disabled || el.type === 'hidden' || el.closest('.honey')) return '';
    var v = (el.type === 'radio' || el.type === 'checkbox') ? null : AM.digits(el.value).trim();
    var custom = function (rule, fallback) { var k = el.getAttribute('data-error-' + rule); return (k && AM.t(k)) || AM.t(fallback); };

    if (el.type === 'radio' || el.type === 'checkbox') {
      if (!el.required) return '';
      var group = el.form ? $$('[name="' + el.name + '"]', el.form) : [el];
      return group.some(function (g) { return g.checked; }) ? '' : custom('required', 'err_required');
    }
    if (!v) return el.required ? custom('required', el.name && /name|اسم/i.test(el.name) ? 'err_name' : 'err_required') : '';
    if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return custom('email', 'err_email');
    if (el.hasAttribute('data-phone')) {
      var sel = phoneSelect(el);
      var r = AM.phone.normalize(v, sel ? sel.value : 'AE');
      if (sel && sel.value !== r.iso && COUNTRIES[r.iso]) sel.value = r.iso;
      if (!r.ok) return custom('phone', r.err);
    }
    var min = parseInt(el.getAttribute('minlength'), 10);
    if (min && v.length < min) return custom('minlength', 'err_required');
    return '';
  };

  function showSuggestion(el) {
    var wrap = fieldWrap(el);
    var box = $('.field__suggest', wrap);
    var fix = AM.emailSuggestion(el.value.trim());
    if (!fix) { if (box) box.remove(); return; }
    if (!box) { box = d.createElement('p'); box.className = 'field__suggest'; wrap.appendChild(box); }
    var text = UI[AM.lang].did_you_mean.split('{email}');
    box.innerHTML = '';
    box.appendChild(d.createTextNode(text[0]));
    var b = d.createElement('button'); b.type = 'button'; b.className = 'ltr'; b.textContent = fix;
    b.addEventListener('click', function () { el.value = fix; box.remove(); setError(el, AM.validateField(el)); el.focus(); });
    box.appendChild(b);
    box.appendChild(d.createTextNode(text[1] || ''));
  }

  /* ---------- 10 Forms (FormSubmit) ---------- */
  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) {
      btn.style.minWidth = btn.offsetWidth + 'px';
      if (!$('.btn__spinner', btn)) btn.insertAdjacentHTML('beforeend', '<span class="btn__spinner" aria-hidden="true"></span>');
      var sr = $('.btn__busy-sr', btn);
      if (!sr) { sr = d.createElement('span'); sr.className = 'sr-only btn__busy-sr'; btn.appendChild(sr); }
      sr.textContent = UI[AM.lang].sending;
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
    } else {
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
      btn.style.minWidth = '';
      var s = $('.btn__busy-sr', btn); if (s) s.remove();
    }
  }
  AM.setBusy = setBusy;

  /* POST JSON to FormSubmit. Resolves on {success:"true"}, rejects otherwise. */
  AM.submit = function (payload, endpoint) {
    return fetch(endpoint || AM.FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (res.ok && (json.success === true || json.success === 'true')) return json;
        var err = new Error(json.message || 'Form submit failed'); err.response = json; throw err;
      });
    });
  };

  /* AM.initForm(form, {
       name: 'waitlist',                   // for tracking
       payload: function (form, data) {}, // REQUIRED: returns the exact FormSubmit object (page keeps its keys)
       endpoint: AM.FORM_ENDPOINT,         // optional
       onSuccess: function (form, payload, json) {}, // optional; default renders opts.success
       success: { title, body, html },     // optional default success panel content
       onError: function (form, err) {}    // optional; default shows the WhatsApp fallback
     })
     data = { values: {name/id: value}, phone: {e164, display, iso}|null, email }
     Field names are never changed. Validation: on blur, then on input once flagged. */
  AM.initForm = function (form, opts) {
    if (!form || form.__am) return;
    form.__am = true;
    opts = opts || {};
    form.setAttribute('novalidate', '');
    var started = false, t0 = 0;
    var controls = function () { return $$('input, select, textarea', form).filter(function (el) { return el.type !== 'hidden' && el.type !== 'submit'; }); };
    var status = $('.form__status', form);
    if (!status) {
      status = d.createElement('p'); status.className = 'form__status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      var actions = $('.form__actions', form) || $('[type="submit"]', form);
      if (actions) actions.parentNode.insertBefore(status, actions); else form.appendChild(status);
    }

    form.addEventListener('focusin', function () {
      if (started) return; started = true; t0 = Date.now();
      AM.track('form_start', { form: opts.name || form.id || 'form' });
    });
    form.addEventListener('blur', function (e) {
      var el = e.target; if (!el.matches || !el.matches('input, select, textarea')) return;
      el.__touched = true;
      if (el.hasAttribute('data-phone') && el.value) {
        var sel = phoneSelect(el);
        var r = AM.phone.normalize(el.value, sel ? sel.value : 'AE');
        if (r.ok) el.value = r.display;
      }
      if (el.type === 'email') { el.value = AM.digits(el.value).trim(); showSuggestion(el); }
      setError(el, AM.validateField(el));
    }, true);
    form.addEventListener('input', function (e) {
      var el = e.target;
      if (el.getAttribute('aria-invalid') === 'true') setError(el, AM.validateField(el));
    });
    form.addEventListener('change', function (e) {
      var el = e.target;
      if (el.type === 'radio' || el.type === 'checkbox') $$('[name="' + el.name + '"]', form).forEach(function (g) { setError(g, ''); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var invalid = [];
      var seenGroups = {};
      controls().forEach(function (el) {
        if ((el.type === 'radio' || el.type === 'checkbox')) { if (seenGroups[el.name]) return; seenGroups[el.name] = 1; }
        var msg = AM.validateField(el);
        setError(el, msg);
        if (msg) {
          invalid.push(el);
          AM.track('form_error', { form: opts.name || 'form', field: el.getAttribute('data-track-field') || el.type, reason: el.value ? 'format' : 'empty' });
        }
      });
      if (invalid.length) {
        status.textContent = fixFieldsText(invalid.length);
        invalid[0].focus();
        return;
      }
      status.textContent = '';

      /* Honeypot: bots fill it; humans never see it. Pretend success. */
      var honey = $('[name="_honey"]', form);
      var data = collect(form);
      var payload = typeof opts.payload === 'function' ? opts.payload(form, data) : data.values;
      var btn = $('[type="submit"]', form);
      if (honey && honey.value) { done(payload, {}); return; }

      setBusy(btn, true);
      AM.submit(payload, opts.endpoint).then(function (json) {
        done(payload, json);
      }, function (err) {
        setBusy(btn, false);
        AM.track('form_submit', { form: opts.name || 'form', result: 'error' });
        if (opts.onError) opts.onError(form, err, data); else defaultError(form, data);
      });

      function done(p, json) {
        setBusy(btn, false);
        AM.track('form_submit', { form: opts.name || 'form', result: 'success', ms_to_submit: t0 ? Date.now() - t0 : 0 });
        if (opts.onSuccess) opts.onSuccess(form, p, json, data); else AM.formSuccess(form, opts.success || {});
      }
    });
  };

  function collect(form) {
    var values = {}, phone = null, email = '';
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name && !el.id) return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      var key = el.name || el.id;
      var v = el.type === 'file' ? '' : AM.digits(el.value).trim();
      if (el.hasAttribute('data-phone')) {
        var sel = phoneSelect(el);
        phone = AM.phone.normalize(v, sel ? sel.value : 'AE');
        v = phone.e164 || v;
      }
      if (el.type === 'email') email = v;
      values[key] = (values[key] && el.type === 'checkbox') ? values[key] + ', ' + v : v;
    });
    return { values: values, phone: phone, email: email };
  }
  AM.collectForm = collect;

  /* Default success: swap the form for a panel and move focus to its heading */
  AM.formSuccess = function (form, s) {
    var panel = d.createElement('div');
    panel.className = 'form-success';
    panel.setAttribute('role', 'status');
    panel.innerHTML = '<svg class="form-success__mark icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' +
      '<h3 tabindex="-1"></h3><p class="muted"></p>' + (s.html || '');
    $('h3', panel).textContent = s.title || '';
    $('p', panel).textContent = s.body || '';
    form.replaceWith(panel);
    $('h3', panel).focus();
    return panel;
  };

  function defaultError(form, data) {
    var box = $('.form__fail', form);
    if (!box) {
      box = d.createElement('div'); box.className = 'form__fail'; box.setAttribute('role', 'alert');
      var anchor = $('.form__actions', form) || $('[type="submit"]', form);
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
    }
    var name = data.values['الاسم / Name'] || data.values.name || '';
    box.innerHTML = '<p></p><a class="btn btn--wa btn--block" data-wa="form_fail">' + AM.icon('whatsapp') + '<span></span></a>';
    $('p', box).textContent = UI[AM.lang].form_fail;
    $('span', box).textContent = UI[AM.lang].form_fail_btn;
    $('a', box).setAttribute('data-wa-vars', JSON.stringify({ name: name, email: data.email }));
    refreshWaLinks($('a', box));
    AM.toast(UI[AM.lang].form_fail, { type: 'error' });
  }

  /* ---------- 11 Session state ---------- */
  /* AM.session.state(CONFIG) -> 'upcoming' | 'live' | 'past' | 'none'
     AM.session.workshopState(CONFIG) -> 'open-free' | 'open-paid' | 'full' | 'waitlist'
     CONFIG keys: eventDate (ISO, with +04:00), durationMin (default 60), seatsFull, sessionType ('free'|'paid')
     Markup hooks, applied on boot and after language changes:
       data-session="past waitlist"   shown only when the state matches one of the words
       data-session-date / data-session-time   filled with the Dubai-time date / time */
  AM.session = {
    state: function (cfg) {
      cfg = cfg || AM.config();
      var start = new Date(cfg.eventDate).getTime();
      if (!cfg.eventDate || isNaN(start)) return 'none';
      var end = start + (cfg.durationMin || 60) * 60000, now = Date.now();
      return now < start ? 'upcoming' : (now < end ? 'live' : 'past');
    },
    workshopState: function (cfg) {
      cfg = cfg || AM.config();
      if (this.state(cfg) !== 'upcoming') return 'waitlist';
      if (cfg.seatsFull) return 'full';
      return cfg.sessionType === 'paid' ? 'open-paid' : 'open-free';
    },
    locale: function () { return AM.lang === 'en' ? 'en-GB' : 'ar-AE-u-nu-latn'; },
    formatDate: function (date, opts) {
      var dt = date ? new Date(date) : new Date(AM.config().eventDate);
      if (isNaN(dt)) return '';
      /* House style: «الأربعاء 5 أغسطس 2026» / "Wednesday 5 August 2026" (no comma after the weekday) */
      return new Intl.DateTimeFormat(this.locale(), Object.assign({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dubai' }, opts || {})).format(dt).replace(/^([^\s،,]+)[،,]\s*/, '$1 ');
    },
    formatTime: function (date) {
      var dt = date ? new Date(date) : new Date(AM.config().eventDate);
      if (isNaN(dt)) return '';
      return new Intl.DateTimeFormat(this.locale(), { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dubai' }).format(dt);
    },
    apply: function () {
      var s = this.state(), w = this.workshopState();
      root.setAttribute('data-session-state', s);
      root.setAttribute('data-workshop-state', w);
      $$('[data-session]').forEach(function (el) {
        var words = el.getAttribute('data-session').split(/\s+/);
        el.hidden = !(words.indexOf(s) > -1 || words.indexOf(w) > -1);
      });
      var self = this;
      $$('[data-session-date]').forEach(function (el) { el.textContent = self.formatDate(el.getAttribute('data-session-date') || null); });
      $$('[data-session-time]').forEach(function (el) { el.textContent = self.formatTime(el.getAttribute('data-session-time') || null); });
      return { state: s, workshop: w };
    }
  };

  /* ---------- 12 Testimonials ---------- */
  /* <section data-testimonials="testimonials" hidden> … <div class="testimonials" data-testimonials-list></div></section>
     Data slot: CONTENT[lang].testimonials = [{ result, body, name, role, workshop, date }]
     The section stays hidden while the array is empty or missing. */
  AM.renderTestimonials = function (section, items) {
    if (!section) return;
    items = (items || []).filter(function (q) { return q && q.name && (q.result || q.body); });
    var list = $('[data-testimonials-list]', section) || section;
    if (!items.length) { section.hidden = true; return; }
    list.innerHTML = '';
    items.forEach(function (q) {
      var fig = d.createElement('figure'); fig.className = 'testimonial';
      fig.innerHTML = '<blockquote><p class="testimonial__result"></p><p class="testimonial__body"></p></blockquote><figcaption class="testimonial__who"><b></b> <span></span></figcaption>';
      $('.testimonial__result', fig).textContent = q.result || '';
      $('.testimonial__body', fig).textContent = q.body || '';
      if (!q.body) $('.testimonial__body', fig).remove();
      $('b', fig).textContent = q.name;
      $('span', fig).textContent = [q.role, q.workshop, q.date].filter(Boolean).join(' · ');
      list.appendChild(fig);
    });
    section.hidden = false;
  };
  function initTestimonials() {
    $$('[data-testimonials]').forEach(function (sec) {
      AM.renderTestimonials(sec, AM.t(sec.getAttribute('data-testimonials') || 'testimonials') || []);
    });
  }

  /* ---------- 13 Dialog sheet ---------- */
  /* <button data-dialog-open="proposal-sheet"> … <dialog class="sheet" id="proposal-sheet"> … <button data-dialog-close> */
  d.addEventListener('click', function (e) {
    var opener = e.target.closest && e.target.closest('[data-dialog-open]');
    if (opener) {
      var dlg = d.getElementById(opener.getAttribute('data-dialog-open'));
      if (dlg && dlg.showModal && !dlg.open) {
        e.preventDefault();
        dlg.showModal(); AM.overlay(true);
        AM.track('sheet_open', { trigger: opener.getAttribute('data-cta') || '' });
        dlg.addEventListener('close', function onClose() { dlg.removeEventListener('close', onClose); AM.overlay(false); });
      }
      return;
    }
    var closer = e.target.closest && e.target.closest('[data-dialog-close]');
    if (closer) { var dl = closer.closest('dialog'); if (dl) dl.close(); return; }
    if (e.target.tagName === 'DIALOG' && e.target.open) {
      var r = e.target.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
    }
  });

  /* ---------- 14 Tracking ---------- */
  /* AM.track(event, props): forwards to window.aiTrack (ai-tracker.js) or no-ops.
     No PII: never pass names, emails, phones, prompt text or form values. */
  AM.track = function (event, props) {
    try {
      var fn = window.aiTrack || window.amTrack;
      if (typeof fn === 'function') fn(event, props || {});
    } catch (e) { /* tracking never breaks the page */ }
  };
  /* Delegated: <a data-track="cta_click" data-cta="hero_primary" data-target="form"> */
  d.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-track]');
    if (!el) return;
    var props = {};
    ['cta', 'target', 'section', 'preset', 'placement'].forEach(function (k) { if (el.dataset[k]) props[k] = el.dataset[k]; });
    if (el.dataset.trackProps) { try { Object.assign(props, JSON.parse(el.dataset.trackProps)); } catch (err) { } }
    AM.track(el.getAttribute('data-track'), props);
  });
  d.addEventListener('toggle', function (e) {
    var det = e.target;
    if (det.tagName === 'DETAILS' && det.open && det.classList.contains('faq__item')) {
      AM.track('faq_open', { q: det.id || det.getAttribute('data-q') || '' });
    }
  }, true);

  /* ---------- 15 Boot ---------- */
  function boot() {
    AM.applyLang();
    AM.session.apply();
    applyTheme(AM.theme.get(), 'init');
    d.addEventListener('am:lang', function () { AM.session.apply(); initTestimonials(); AM.theme.refresh(); });
    initHeader();
    initCtaBar();
    initTestimonials();
    AM.ready = true;
    var q = window.AMQ || [];
    window.AMQ = { push: function (fn) { try { fn(AM); } catch (e) { console.error(e); } } };
    q.forEach(function (fn) { window.AMQ.push(fn); });
    emit('am:ready', AM);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
