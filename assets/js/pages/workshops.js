/* =====================================================================
   Workshop pages only: free-workshop.html and workshop-register.html.
   Load with `defer` AFTER site.js and motion.js. Reads the page's CONFIG +
   CONTENT (edit zone in each page). Everything here is progressive: the HTML
   already ships the waitlist state, and this file adjusts it from
   CONFIG.eventDate through AM.session.

   <body data-ws-page="free|paid">
   [data-ws="key"] / [data-ws-html="key"]   text per state: CONTENT key_waitlist | key_open | key_full
   [data-ws-past]                           last session date (CONFIG.lastSessionDate, else eventDate)
   [data-ws-next]                           next session value in the readout
   [data-ws-clock]                          live Dubai time (GST)
   [data-pay-slot="hero|steps|final"]       Ziina button is inserted ONLY in the open-paid state
   [data-ws-primary]                        header CTA / sticky bar primary, retargeted per state
   window.AMPage.render()                   re-run after changing CONFIG in the console (QA)
   ===================================================================== */
(function () {
  'use strict';

  (window.AMQ = window.AMQ || []).push(function (AM) {
    var d = document, root = d.documentElement;
    var $ = AM.$, $$ = AM.$$;
    var PAGE = d.body.getAttribute('data-ws-page') === 'paid' ? 'paid' : 'free';
    var cfg = AM.config();
    var params = new URLSearchParams(location.search);
    var current = { state: '', workshop: '', variant: '' };

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function variantOf(w) { return w === 'full' ? 'full' : (w === 'open-free' || w === 'open-paid') ? 'open' : 'waitlist'; }

    function daysText(n) {
      if (AM.lang === 'en') return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days';
      if (n === 0) return 'اليوم';
      if (n === 1) return 'غداً';
      if (n === 2) return 'بعد يومين';
      if (n <= 10) return 'بعد ' + n + ' أيام';
      return 'بعد ' + n + ' يوماً';
    }
    function vars() {
      var s = AM.session;
      var past = cfg.lastSessionDate || cfg.eventDate;
      /* Whole calendar days in Dubai between today and the session day */
      var dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' });
      var days = NaN;
      try { days = Math.round((Date.parse(dayKey.format(new Date(cfg.eventDate))) - Date.parse(dayKey.format(new Date()))) / 86400000); } catch (e) { }
      var ahead = new Date(cfg.eventDate).getTime() > Date.now();
      return {
        date: s.formatDate(cfg.eventDate),
        time: s.formatTime(cfg.eventDate),
        past_date: s.formatDate(past),
        past_iso: String(past || '').slice(0, 10),
        date_mono: monoDate(cfg.eventDate),
        past_mono: monoDate(past),
        days_left: (ahead && days >= 0 && days < 14) ? daysText(days) : ''
      };
    }
    var monoFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' });
    function monoDate(x) { var dt = new Date(x); return isNaN(dt) ? '' : monoFmt.format(dt).replace(/,/g, '').toUpperCase(); }
    function pick(key, variant, v) {
      var t = AM.t(key + '_' + variant);
      if (!t && variant !== 'waitlist') t = AM.t(key + '_waitlist');
      if (!t) t = AM.t(key);
      return typeof t === 'string' ? AM.fill(t, v) : '';
    }

    /* ---------- Primary CTAs (header + sticky bar) ---------- */
    function setPrimary(el, w, v) {
      var label = $('.btn__label', el) || el;
      var payOpen = PAGE === 'paid' && w === 'open-paid';
      el.removeAttribute('data-wa'); el.removeAttribute('data-wa-vars'); el.removeAttribute('aria-label');
      if (payOpen) {
        label.textContent = AM.t('cta_pay');
        el.setAttribute('href', cfg.payLink);
        el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener');
        el.setAttribute('data-track', 'pay_click'); el.setAttribute('data-pay', '');
        el.setAttribute('data-placement', el.getAttribute('data-pay-placement') || (el.hasAttribute('data-cta-primary') ? 'sticky' : 'header'));
      } else {
        label.textContent = pick('cta_main', variantOf(w), v);
        el.setAttribute('href', '#register');
        el.removeAttribute('target'); el.removeAttribute('rel'); el.removeAttribute('data-pay');
        el.setAttribute('data-track', 'cta_click'); el.removeAttribute('data-placement');
      }
    }

    /* ---------- Ziina pay button: rendered only in open-paid ---------- */
    function renderPay(w) {
      var tpl = d.getElementById('pay-tpl');
      $$('[data-pay-slot]').forEach(function (slot) {
        slot.innerHTML = '';
        if (!tpl || PAGE !== 'paid' || w !== 'open-paid' || !cfg.payLink) return;
        var node = tpl.content.firstElementChild.cloneNode(true);
        node.setAttribute('href', cfg.payLink);
        node.setAttribute('data-placement', slot.getAttribute('data-pay-slot'));
        var lab = $('[data-i18n]', node) || node;
        lab.textContent = AM.t('cta_pay');
        slot.appendChild(node);
      });
    }

    /* ---------- Event JSON-LD only while a future date is set ---------- */
    function renderEventLd(state) {
      var old = d.getElementById('ws-event-ld');
      if (old) old.remove();
      if (state !== 'upcoming') return;
      var start = new Date(cfg.eventDate);
      var end = new Date(start.getTime() + (cfg.durationMin || 60) * 60000);
      var url = (d.querySelector('link[rel="canonical"]') || {}).href || location.href;
      var paid = PAGE === 'paid';
      var ld = {
        '@context': 'https://schema.org', '@type': 'Event',
        name: AM.content().ar.ld_event_name || d.title,
        startDate: cfg.eventDate,
        endDate: end.toISOString(),
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        isAccessibleForFree: !paid,
        location: { '@type': 'VirtualLocation', url: url },
        organizer: { '@type': 'Person', name: 'Ahmad Muhanna', alternateName: 'أحمد مهنا', url: 'https://ahmadmuhanna.com/' },
        performer: { '@type': 'Person', name: 'Ahmad Muhanna' },
        inLanguage: ['ar', 'en'],
        offers: { '@type': 'Offer', price: paid ? '50' : '0', priceCurrency: 'AED', url: url,
          availability: cfg.seatsFull ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' }
      };
      var s = d.createElement('script');
      s.type = 'application/ld+json'; s.id = 'ws-event-ld'; s.textContent = JSON.stringify(ld);
      d.head.appendChild(s);
    }

    /* ---------- Render the whole state ---------- */
    function render() {
      var st = AM.session.apply();
      var w = st.workshop, variant = variantOf(w), v = vars();
      current = { state: st.state, workshop: w, variant: variant };
      root.setAttribute('data-ws-variant', variant);

      $$('[data-ws]').forEach(function (el) { el.textContent = pick(el.getAttribute('data-ws'), variant, v); });
      $$('[data-ws-html]').forEach(function (el) { el.innerHTML = pick(el.getAttribute('data-ws-html'), variant, v); });
      $$('[data-ws-past]').forEach(function (el) { el.textContent = v.past_date; if (v.past_iso) el.setAttribute('datetime', v.past_iso); });
      $$('[data-ws-next]').forEach(function (el) {
        if (variant === 'waitlist') { el.textContent = AM.t('ro_next_tba'); return; }
        el.innerHTML = '<time datetime="' + esc(cfg.eventDate) + '">' + esc(v.date) + '</time> · ' +
          '<span class="num">' + esc(v.time) + '</span> ' + esc(AM.t('gst')) +
          (v.days_left ? ' <span class="faint">· ' + esc(v.days_left) + '</span>' : '');
      });
      $$('.readout').forEach(function (el) { el.setAttribute('data-open', String(variant === 'open')); });

      /* WhatsApp links that carry the session date */
      $$('[data-wa-date]').forEach(function (el) { el.setAttribute('data-wa-vars', JSON.stringify({ date: v.date })); });
      $$('[data-ws-primary]').forEach(function (el) { setPrimary(el, w, v); });
      var barWa = $('.cta-bar__wa');
      if (barWa) {
        barWa.setAttribute('data-wa', PAGE === 'paid' ? (w === 'open-paid' ? 'paid_q' : 'paid_notify') : 'waitlist_q');
        if (w === 'open-paid') barWa.setAttribute('data-wa-vars', JSON.stringify({ date: v.date }));
      }
      renderPay(w);
      AM.refreshWaLinks();
      renderEventLd(st.state);
      initReturning(variant);
      checkPaidReturn();
      return current;
    }

    /* ---------- Live Dubai clock in the readout ---------- */
    var clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' });
    function tickClock() {
      var now = new Date();
      $$('[data-ws-clock]').forEach(function (el) {
        el.textContent = 'GST ' + clockFmt.format(now);
        el.setAttribute('datetime', now.toISOString());
      });
    }
    tickClock();
    setInterval(tickClock, 30000);

    /* ---------- Waitlist / registration form ---------- */
    var form = d.getElementById('waitlist-form');
    var panelHead = $('.ws-panel__head');

    function chipText(name) {
      if (!form) return '';
      var c = $('input[name="' + name + '"]:checked', form);
      var span = c && c.closest('label') && $('span', c.closest('label'));
      return span ? span.textContent.trim() : '';
    }
    function sourceTag() {
      if (params.get('utm_source')) return params.get('utm_source');
      if (params.get('from')) return 'internal:' + params.get('from');
      if (params.get('ref')) return 'ref:' + params.get('ref');
      try { if (d.referrer) return 'ref:' + new URL(d.referrer).hostname.replace(/^www\./, ''); } catch (e) { }
      return 'direct';
    }

    function payload(f, data) {
      var variant = current.variant || 'waitlist';
      if (PAGE === 'paid' && variant === 'open') variant = 'waitlist';
      var vals = data.values, v = vars();
      var name = vals['الاسم / Name'] || '';
      var email = data.email || vals.email || '';
      var mailVars = { name: name, date: v.date, time: v.time, link: cfg.workshopLink || '' };
      var reply = AM.fill(AM.t('mail_reply_' + variant) || AM.t('mail_reply_waitlist'), mailVars);
      /* The attendance link only ever goes out for an open session */
      if (variant !== 'open' && cfg.workshopLink) reply = reply.split(cfg.workshopLink).join('');
      var subj = (AM.content().ar['mail_subject_' + variant] || AM.content().ar.mail_subject_waitlist || '') + ' — ' + AM.lang.toUpperCase();
      return {
        _subject: subj,
        _template: 'table',
        _captcha: 'false',
        _autoresponse: reply,
        email: email,
        'الاسم / Name': name,
        'رقم الهاتف / Phone': (data.phone && data.phone.e164) || vals['رقم الهاتف / Phone'] || '',
        'الإيميل / Email': email,
        'نوع البزنس / Business type': chipText('نوع البزنس / Business type'),
        'الخبرة في AI / Experience': chipText('الخبرة في AI / Experience'),
        'اسم البزنس / Business': vals['اسم البزنس / Business'] || '',
        'ويبسايت أو انستاغرام / Website-Instagram': vals['ويبسايت أو انستاغرام / Website-Instagram'] || '',
        'الحالة / Status': variant === 'open' ? 'registered' : variant,
        'الورشة / Workshop': PAGE,
        'المصدر / Source': sourceTag(),
        'اللغة / Language': AM.lang
      };
    }

    function success(f, p) {
      var variant = current.variant === 'open' && PAGE === 'free' ? 'open' : (current.variant === 'full' ? 'full' : 'waitlist');
      var v = vars();
      var email = p.email || '';
      AM.store.set('am_waitlisted', JSON.stringify({ ts: Date.now(), state: variant, ws: PAGE }));
      var bodyTpl = AM.fill(AM.t('ok_p_' + variant) || AM.t('ok_p_waitlist'), { date: v.date, time: v.time });
      var body = bodyTpl.split('{email}').map(esc).join('<bdi class="ltr">' + esc(email) + '</bdi>');
      var guideHref = 'learn-ai.html' + (AM.lang === 'en' ? '?lang=en' : '') + '#m1';
      var actions = '';
      if (variant === 'open' && cfg.workshopLink) {
        actions += '<a class="btn btn--primary btn--block" href="' + esc(cfg.workshopLink) + '" target="_blank" rel="noopener" data-track="cta_click" data-cta="success_calendar" data-target="calendar">' +
          '<svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg><span>' + esc(AM.t('ok_cal')) + '</span></a>';
        actions += '<a class="btn btn--secondary btn--block" href="' + guideHref + '" data-track="cta_click" data-cta="success_guide" data-target="guide">' + esc(AM.t('ok_guide')) + '</a>';
      } else {
        actions += '<a class="btn btn--primary btn--block" href="' + guideHref + '" data-track="cta_click" data-cta="success_guide" data-target="guide">' + esc(AM.t('ok_guide')) + '</a>';
      }
      actions += '<a class="btn btn--wa btn--block" href="https://wa.me/" data-wa="share_ws" data-track="share_click" data-track-props=\'{"content":"waitlist","method":"wa"}\'>' +
        AM.icon('whatsapp') + '<span>' + esc(AM.t('ok_share')) + '</span></a>';
      /* Submit morph: the button turns into a check, then the panel swaps in */
      var btn = $('[type="submit"]', f);
      var finish = function () {
      var panel = AM.formSuccess(f, {
        title: AM.t('ok_h_' + variant) || AM.t('ok_h_waitlist'),
        body: '',
        html: '<p class="muted">' + body + '</p><div class="ws-success__actions">' + actions + '</div>'
      });
      var empty = panel.querySelector('h3 + p.muted');
      if (empty && !empty.textContent.trim()) empty.remove();
      if (panelHead) panelHead.hidden = true;
      AM.refreshWaLinks();
      AM.toast(AM.t('toast_ok_' + variant) || AM.t('toast_ok_waitlist'), { type: 'success' });
      };
      if (btn && !AM.reducedMotion()) {
        btn.classList.add('ws-done');
        btn.insertAdjacentHTML('beforeend', '<svg class="ws-done__check icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>');
        setTimeout(finish, 520);
      } else finish();
    }

    if (form) {
      AM.initForm(form, { name: 'waitlist', payload: payload, onSuccess: success });
    }

    /* Optional legacy path: CONFIG.scriptURL (Google Apps Script) instead of FormSubmit */
    if (cfg.scriptURL) {
      AM.submit = function (p) {
        var fields = {};
        Object.keys(p).forEach(function (k) { if (k.charAt(0) !== '_' && k !== 'email') fields[k] = p[k]; });
        return fetch(cfg.scriptURL, {
          method: 'POST',
          body: JSON.stringify({ adminSubject: p._subject, replySubject: AM.t('mail_reply_subject'), replyBody: p._autoresponse, email: p.email, fields: fields })
        }).then(function (r) { return r.json(); }).then(function (j) { if (!j || !j.ok) throw new Error('script failed'); return j; });
      };
    }

    /* Returning visitor who already joined the waitlist on this device */
    var returningBox = $('[data-ws-returning]');
    function initReturning(variant) {
      if (!returningBox || !form || !form.isConnected) return;
      var on = variant === 'waitlist' && !!AM.store.get('am_waitlisted') && !returningBox.__dismissed;
      returningBox.hidden = !on;
      form.hidden = on;
    }
    if (returningBox) {
      var again = $('[data-ws-again]', returningBox);
      if (again) again.addEventListener('click', function () {
        returningBox.__dismissed = true; returningBox.hidden = true; form.hidden = false;
        var first = $('input:not([type="hidden"])', form); if (first) first.focus();
      });
    }

    /* ---------- Paid: recover the visitor after Ziina ---------- */
    var banner = d.getElementById('ws-return');
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-pay]');
      if (a) AM.store.set('am_paid_click', String(Date.now()), true);
    });
    function checkPaidReturn() {
      if (!banner || PAGE !== 'paid' || current.workshop !== 'open-paid') { if (banner) banner.hidden = true; return; }
      var t = parseInt(AM.store.get('am_paid_click', true), 10);
      var mins = (Date.now() - t) / 60000;
      if (!t || mins > 30 || mins < 0.05 || banner.__dismissed) return;
      if (banner.hidden) {
        banner.hidden = false;
        AM.track('pay_return', { mins_since_click: Math.round(mins) });
      }
      /* Sticky bar now asks for the receipt */
      var bar = $('[data-cta-bar] [data-cta-primary]');
      if (bar) {
        var lab = $('.btn__label', bar) || bar;
        lab.textContent = AM.t('cta_receipt');
        bar.setAttribute('href', 'https://wa.me/971522346020');
        bar.removeAttribute('target'); bar.removeAttribute('data-pay');
        bar.setAttribute('data-wa', 'receipt');
        bar.setAttribute('data-wa-vars', JSON.stringify({ date: vars().date }));
        bar.setAttribute('data-track', 'cta_click'); bar.setAttribute('data-cta', 'sticky_receipt');
      }
      var barWa = $('.cta-bar__wa');
      if (barWa) { barWa.setAttribute('data-wa', 'receipt'); barWa.setAttribute('data-wa-vars', JSON.stringify({ date: vars().date })); }
      AM.refreshWaLinks();
    }
    if (banner) {
      var x = $('[data-ws-dismiss]', banner);
      if (x) x.addEventListener('click', function () { banner.__dismissed = true; banner.hidden = true; });
      window.addEventListener('focus', checkPaidReturn);
      d.addEventListener('visibilitychange', function () { if (!d.hidden) checkPaidReturn(); });
    }

    /* Alias stub (workshop.html) attribution: fire once the tracker is loaded */
    if (params.get('alias')) {
      window.addEventListener('load', function () {
        AM.track('alias_redirect', { alias: params.get('alias') });
        /* ai-tracker.js has read ?ref by now; tidy the address bar and the language switch */
        try {
          var u = new URL(location.href);
          u.searchParams.delete('alias'); u.searchParams.delete('ref');
          history.replaceState(history.state, '', u.pathname + u.search + u.hash);
          var to = AM.lang === 'ar' ? 'en' : 'ar';
          $$('[data-lang-switch]').forEach(function (a) { a.setAttribute('href', AM.langHref(to)); });
        } catch (e) { }
      });
    }


    /* =================== Motion + micro-interactions (page-local) =================== */
    var reduced = AM.reducedMotion();

    /* Section reveals: wipe (quote), settle (band / final). Only below the fold. */
    if (!reduced && 'IntersectionObserver' in window) {
      /* Observe the parent: a fully clipped target may never report as intersecting */
      var rio = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (!e.isIntersecting) return;
          (e.target.__wsReveal || []).forEach(function (el) { el.classList.remove('ws-pre'); });
          rio.unobserve(e.target);
        });
      }, { threshold: 0.2 });
      $$('[data-ws-reveal]').forEach(function (el) {
        if (el.getBoundingClientRect().top < innerHeight * 0.92) return;
        var host = el.parentElement;
        (host.__wsReveal = host.__wsReveal || []).push(el);
        el.classList.add('ws-pre'); rio.observe(host);
      });
    }

    /* Timeline that draws as the steps scroll through the viewport */
    var tl = $('[data-ws-timeline]');
    if (tl && !reduced) {
      var steps = $$(':scope > li', tl), ticking = false;
      var drawTl = function () {
        ticking = false;
        var r = tl.getBoundingClientRect(), vh = innerHeight;
        var p = Math.max(0, Math.min(1, (vh * 0.75 - r.top) / Math.max(1, r.height)));
        tl.style.setProperty('--draw', p.toFixed(3));
        steps.forEach(function (li) { li.classList.toggle('is-reached', li.getBoundingClientRect().top < vh * 0.75); });
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(drawTl); } }, { passive: true });
      window.addEventListener('resize', drawTl, { passive: true });
      drawTl();
    } else if (tl) { $$(':scope > li', tl).forEach(function (li) { li.classList.add('is-reached'); }); }

    /* Button ripple from the press point */
    d.addEventListener('pointerdown', function (e) {
      if (reduced || AM.reducedMotion()) return;
      var b = e.target.closest && e.target.closest('.ws-page .btn');
      if (!b || b.disabled || b.getAttribute('aria-busy') === 'true') return;
      var r = b.getBoundingClientRect();
      var dot = d.createElement('span');
      dot.className = 'ws-ripple'; dot.setAttribute('aria-hidden', 'true');
      dot.style.left = (e.clientX - r.left) + 'px'; dot.style.top = (e.clientY - r.top) + 'px';
      dot.style.setProperty('--ripple-scale', String(Math.ceil(Math.hypot(r.width, r.height) / 6)));
      b.appendChild(dot);
      setTimeout(function () { dot.remove(); }, 450);
    }, { passive: true });

    /* Card spotlight follows the pointer (fine pointers only) */
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      $$('.bento__tile').forEach(function (tile) {
        tile.addEventListener('pointermove', function (e) {
          var r = tile.getBoundingClientRect();
          tile.style.setProperty('--mx', (e.clientX - r.left) + 'px');
          tile.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });
      });
    }

    /* Fields: focus line wrapper, valid check, shake on a failed submit */
    function enhanceFields(scope) {
      $$('.field > .input, .field > .phone', scope).forEach(function (el) {
        var wrap;
        if (el.classList.contains('phone')) { wrap = el; wrap.classList.add('ws-input'); }
        else {
          wrap = d.createElement('span'); wrap.className = 'ws-input';
          if (el.type === 'email' || el.type === 'tel' || el.classList.contains('ltr')) wrap.classList.add('ws-input--ltr');
          el.parentNode.insertBefore(wrap, el); wrap.appendChild(el);
        }
        if (!$('.ws-valid', wrap)) wrap.insertAdjacentHTML('beforeend', '<svg class="ws-valid icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>');
      });
    }
    function markValid(el) {
      var wrap = el.closest('.ws-input'); if (!wrap) return;
      var ok = !!el.value.trim() && el.getAttribute('aria-invalid') !== 'true' && !AM.validateField(el);
      wrap.classList.toggle('is-valid', ok);
    }
    if (form) {
      enhanceFields(form);
      form.addEventListener('blur', function (e) { if (e.target.matches && e.target.matches('.input')) setTimeout(function () { markValid(e.target); }, 0); }, true);
      form.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('.input') && e.target.closest('.ws-input.is-valid')) markValid(e.target); });
      form.addEventListener('submit', function () {
        setTimeout(function () {
          $$('[aria-invalid="true"]', form).forEach(function (el) {
            var t = el.closest('.ws-input') || el;
            t.classList.remove('ws-shake'); void t.offsetWidth; t.classList.add('ws-shake');
            setTimeout(function () { t.classList.remove('ws-shake'); }, 360);
          });
        }, 0);
      });
    }

    d.addEventListener('am:lang', render);
    render();
    window.AMPage = { render: render, state: function () { return current; } };
  });
})();
