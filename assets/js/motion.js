/* =====================================================================
   ahmadmuhanna.com · motion.js  (progressive enhancement, load with `defer`
   AFTER site.js). Every element is fully visible and usable without this file.

   Without any library:          After GSAP + ScrollTrigger (+ Lenis) load:
   [data-prompt-demo]  live demo  [data-reveal]          fade-up once, below fold only
   [data-field]        dot field  [data-reveal-stagger]  children in sequence
   details > .details__body       [data-parallax]        image drift (fine pointer, lg)
   [data-scroll-progress]         Lenis smooth scroll    fine pointer, no reduced motion
   [data-toc]          active link
   [data-marquee]      logo strip
   [data-count]        real numbers only
   [data-magnetic]     opt-in, fine pointer only

   Reduced motion (OS setting or ?motion=reduced): no libraries load, the demo
   shows its finished state, the field is drawn once, everything is instant.
   Easing: one exponential family (expo.out / expo.in). Durations 150-700ms.
   Theme: no colour values in this file. The dot field reads CSS tokens and
   re-reads them on `am:themechange`; AMMotion.recolor() forces a re-read.
   ===================================================================== */
(function () {
  'use strict';

  var d = document, root = d.documentElement;
  if (/[?&]motion=reduced/.test(location.search)) root.classList.add('reduce-motion');

  var RM = matchMedia('(prefers-reduced-motion: reduce)');
  function reduced() { return RM.matches || root.classList.contains('reduce-motion'); }
  var FINE = matchMedia('(pointer: fine)');
  function inApp() { return /Instagram|FBAN|FBAV|LinkedInApp/i.test(navigator.userAgent); }
  function lite() {
    var c = navigator.connection;
    return !!(c && c.saveData) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 && !FINE.matches) || inApp();
  }
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  var expoOut = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
  var EASE_IN = 'cubic-bezier(.7, 0, .84, 0)';

  /* Pinned CDN builds with Subresource Integrity */
  var LIBS = {
    gsap: { src: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js', integrity: 'sha384-HOvlOYPIs/zjoIkWUGXkVmXsjr8GuZLV+Q+rcPwmJOVZVpvTSXQChiN4t9Euv9Vc' },
    st: { src: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/ScrollTrigger.min.js', integrity: 'sha384-P8VzCVnT9NBUkMrpcIZrJbA7EBjJvh/fJS6PmP+4nLIM284DtsImIv8D0fFjIkeh' },
    lenis: { src: 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js', integrity: 'sha384-jqpi9VmOdhyLoLURgjCn7EpnG9BbnHW57ibIZoeaIU+erWDH3k8fQQg0xH2ySjnw' }
  };
  function load(lib) {
    return new Promise(function (resolve, reject) {
      var s = d.createElement('script');
      s.src = lib.src; s.integrity = lib.integrity; s.crossOrigin = 'anonymous'; s.async = true;
      s.onload = resolve; s.onerror = reject;
      d.head.appendChild(s);
    });
  }

  var Motion = window.AMMotion = { demos: [], fields: [], lenis: null, reduced: reduced };
  var AM = null;
  function t(key, fallback) { var v = AM && AM.t ? AM.t(key) : ''; return v || fallback || ''; }
  function track(e, p) { if (AM && AM.track) AM.track(e, p); }

  /* ---------- Live prompt demo: [data-prompt-demo="CONTENT key"] ----------
     CONTENT[lang][key] = [{ id, label, parts: [{ tag, text }], answer }]
     The HTML ships scenario 1 in its finished state (no-JS, reduced motion).
     Colours: the demo is DOM, styled only by site.css tokens (--c-term-bg,
     --c-signal-ink, --c-ink-*), so a theme change restyles it live; no colour
     values live in JS.
     JS replays: prompt types (~40 chars/s, <=2.5s), each part's tag lights
     as it completes, a short beat, then the answer streams in word chunks
     (<=3.5s), holds, and moves to the next scenario. It plays each scenario
     once (data-demo-loop="true" to repeat), pauses off-screen and in hidden
     tabs, and a chip tap plays that preset. Honest label lives in the footer. */
  function PromptDemo(el) {
    var key = el.getAttribute('data-prompt-demo') || 'hero_demo';
    var list = AM && AM.t ? AM.t(key) : null;
    if (!Array.isArray(list) || !list.length) return null;
    var presetsBox = $('[data-demo-presets]', el);
    var screen = $('[data-demo-screen]', el);
    var promptBox = $('[data-demo-prompt]', el);
    var answerBox = $('[data-demo-answer]', el);
    var stateLabel = $('[data-demo-state]', el);
    var replayBtn = $('[data-demo-replay]', el);
    var skipBtn = $('[data-demo-skip]', el);
    var sr = $('[data-demo-sr]', el);
    var loop = el.getAttribute('data-demo-loop') === 'true';
    var api = { el: el };
    var idx = 0, autoplay = !reduced(), played = 0, running = false, visible = false, started = false;
    var phase = 'idle', elapsed = 0, last = 0, raf = 0, userRun = false;
    var parts = [], answerText = null, caret = null, tokens = [], totalChars = 0, typeDur = 0, ansDur = 0;
    var HOLD = 2600, BEAT = 380;

    /* Visual layer is aria-hidden; the sr element carries the full text */
    if (screen) screen.setAttribute('aria-hidden', 'true');

    function chips() {
      if (!presetsBox) return;
      presetsBox.innerHTML = '';
      list.forEach(function (s, i) {
        var b = d.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = s.label;
        b.setAttribute('aria-pressed', String(i === idx));
        b.addEventListener('click', function () {
          autoplay = false; userRun = true;
          track('demo_preset', { preset: s.id || String(i) });
          play(i);
        });
        presetsBox.appendChild(b);
      });
    }
    function pressChip() {
      if (!presetsBox) return;
      $$('.chip', presetsBox).forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === idx)); });
    }
    function setState(on) {
      el.classList.toggle('is-running', on);
      if (stateLabel) stateLabel.textContent = t(on ? 'demo_typing' : 'demo_ready');
      if (replayBtn) replayBtn.hidden = on;
      if (skipBtn) skipBtn.hidden = !on;
    }
    function fullText(s) {
      return s.parts.map(function (p) { return p.tag + ': ' + p.text; }).join('\n') + '\n\n' + t('demo_answer') + ': ' + s.answer;
    }
    function build(s) {
      promptBox.innerHTML = '';
      parts = s.parts.map(function (p) {
        var row = d.createElement('p'); row.className = 'demo__part';
        var tag = d.createElement('span'); tag.className = 'demo__tag'; tag.textContent = p.tag;
        var txt = d.createElement('span'); txt.className = 'demo__text';
        row.appendChild(tag); row.appendChild(txt); promptBox.appendChild(row);
        return { row: row, txt: txt, text: p.text, shown: -1 };
      });
      answerBox.innerHTML = '';
      var lab = d.createElement('span'); lab.className = 'demo__answer-label';
      lab.innerHTML = '<span class="status-light is-on" aria-hidden="true"></span>';
      lab.appendChild(d.createTextNode(t('demo_answer')));
      answerText = d.createElement('span');
      answerBox.appendChild(lab); answerBox.appendChild(answerText);
      caret = d.createElement('span'); caret.className = 'demo__caret';
      tokens = s.answer.split(/(\s+)/);
      totalChars = parts.reduce(function (n, p) { return n + p.text.length; }, 0);
      typeDur = Math.min(2500, totalChars / 40 * 1000);
      ansDur = Math.min(3500, tokens.length * 40);
      if (sr) sr.textContent = fullText(s);
    }
    function renderFinal() {
      parts.forEach(function (p) { p.row.classList.remove('is-pending', 'is-typing'); p.txt.textContent = p.text; });
      answerBox.classList.remove('is-pending');
      answerText.textContent = list[idx].answer;
      if (caret.parentNode) caret.remove();
    }
    function renderAt() {
      if (phase === 'prompt') {
        var n = Math.floor(Math.min(1, elapsed / typeDur) * totalChars), acc = 0;
        parts.forEach(function (p) {
          var len = p.text.length, show = Math.max(0, Math.min(len, n - acc));
          var started = n > acc || (acc === 0);
          p.row.classList.toggle('is-pending', !started);
          p.row.classList.toggle('is-typing', started && show < len);
          if (show !== p.shown) { p.txt.textContent = p.text.slice(0, show); p.shown = show; }
          if (started && show < len) p.txt.appendChild(caret);
          acc += len;
        });
      } else if (phase === 'beat') {
        parts.forEach(function (p) { p.row.classList.remove('is-typing', 'is-pending'); p.txt.textContent = p.text; });
        answerBox.classList.remove('is-pending');
        answerText.textContent = '';
        answerText.appendChild(caret);
      } else if (phase === 'answer') {
        var k = Math.ceil(Math.min(1, elapsed / ansDur) * tokens.length);
        answerText.textContent = tokens.slice(0, k).join('');
        answerText.appendChild(caret);
      }
      if (screen) screen.scrollTop = screen.scrollHeight;
    }
    function frame(now) {
      raf = 0;
      if (!running) return;
      if (!visible || d.hidden) { last = 0; return; } /* paused; resumes on visibility */
      var dt = last ? Math.min(64, now - last) : 16; last = now;
      elapsed += dt;
      if (phase === 'prompt' && elapsed >= typeDur) { phase = 'beat'; elapsed = 0; }
      else if (phase === 'beat' && elapsed >= BEAT) { phase = 'answer'; elapsed = 0; }
      else if (phase === 'answer' && elapsed >= ansDur) { finish(false); return; }
      renderAt();
      raf = requestAnimationFrame(frame);
    }
    function finish(skipped) {
      renderFinal();
      running = false; phase = 'hold'; elapsed = 0; setState(false);
      track('demo_complete', { preset: list[idx].id || String(idx), skipped: !!skipped });
      if (userRun && sr) { sr.setAttribute('aria-live', 'polite'); sr.textContent = fullText(list[idx]); }
      played++;
      if (autoplay && (loop || played < list.length)) {
        holdTimer = setTimeout(function hold() {
          if (!visible || d.hidden) { holdTimer = setTimeout(hold, 400); return; }
          play((idx + 1) % list.length);
        }, HOLD);
      }
    }
    var holdTimer = 0;
    function play(i) {
      clearTimeout(holdTimer);
      if (raf) cancelAnimationFrame(raf), raf = 0;
      idx = i; pressChip();
      build(list[idx]);
      if (sr) sr.removeAttribute('aria-live');
      if (reduced()) { renderFinal(); setState(false); return; }
      parts.forEach(function (p) { p.row.classList.add('is-pending'); });
      answerBox.classList.add('is-pending');
      phase = 'prompt'; elapsed = 0; last = 0; running = true; setState(true);
      if (!started) { started = true; track('demo_start', { preset: list[idx].id || String(idx) }); }
      raf = requestAnimationFrame(frame);
    }
    function resume() { if (running && !raf && visible && !d.hidden) raf = requestAnimationFrame(frame); }

    chips();
    build(list[0]); renderFinal(); setState(false);
    if (reduced()) el.classList.add('is-static');
    if (replayBtn) replayBtn.addEventListener('click', function () { autoplay = false; userRun = true; play(idx); });
    if (skipBtn) skipBtn.addEventListener('click', function () {
      if (!running) return; autoplay = false; if (raf) cancelAnimationFrame(raf), raf = 0; finish(true);
    });
    d.addEventListener('visibilitychange', resume);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        var e = en[0];
        visible = e.isIntersecting;
        if (e.intersectionRatio >= 0.5 && autoplay && !started && !reduced()) play(0);
        resume();
      }, { threshold: [0, 0.5] }).observe(el);
    }
    d.addEventListener('am:lang', function () {
      list = AM.t(key); if (!Array.isArray(list)) return;
      chips(); build(list[idx]); renderFinal(); setState(false);
    });
    api.play = play;
    api.stop = function () { autoplay = false; if (running) finish(true); };
    return api;
  }

  /* ---------- Generative dot field: [data-field] ----------
     Canvas 2D grid of dots at <=12% ink. Near the pointer or a touch point dots
     brighten and drift away a few pixels, then settle. It renders only while
     something is moving (no idle frames), caps at 30fps on touch screens,
     pauses off-screen and in hidden tabs, and is drawn once for reduced
     motion, Save-Data, low-end devices and in-app browsers.
     Options: data-field-spacing="22" data-field-radius="150" */
  function DotField(host) {
    var canvas = d.createElement('canvas');
    canvas.className = 'field-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return null; }
    host.classList.add('field-ready');

    var coarse = matchMedia('(pointer: coarse)').matches;
    var small = matchMedia('(max-width: 767px)').matches;
    var spacing = parseFloat(host.getAttribute('data-field-spacing')) || (small ? 26 : 22);
    var R = parseFloat(host.getAttribute('data-field-radius')) || (small ? 96 : 150);
    var MAX_DISP = small ? 4 : 6;
    var BASE = 0.11, PEAK = 0.62, LEVELS = 8; /* overwritten from CSS tokens by readColors() */
    var isStatic = reduced() || lite();
    var w = 0, h = 0, dpr = 1, n = 0;
    var bx, by, ox, oy, br;          /* base positions, offsets, brightness */
    var px = -9999, py = -9999, active = false;
    var visible = true, raf = 0, last = 0, rect = null;
    var stats = { frames: 0, total: 0, avg: 0, dots: 0 };
    var ink = '';
    /* Colours come from CSS tokens (--c-field-dot, --field-dot-base, --field-dot-peak),
       re-read on am:themechange and on OS colour-scheme change. The canvas
       normalises any CSS colour to #rrggbb / rgba(), which we split into channels. */
    function readColors() {
      var cs = getComputedStyle(host);
      var raw = cs.getPropertyValue('--c-field-dot').trim() || cs.color;
      var b = parseFloat(cs.getPropertyValue('--field-dot-base')), p = parseFloat(cs.getPropertyValue('--field-dot-peak'));
      if (isFinite(b)) BASE = b;
      if (isFinite(p)) PEAK = p;
      ctx.fillStyle = cs.color; ctx.fillStyle = raw;
      var c = String(ctx.fillStyle), m;
      if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c))) ink = parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16);
      else if ((m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(c))) ink = m[1] + ', ' + m[2] + ', ' + m[3];
    }
    readColors();

    function layout() {
      rect = host.getBoundingClientRect();
      w = Math.round(rect.width); h = Math.round(rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var cols = Math.ceil(w / spacing) + 1, rows = Math.ceil(h / spacing) + 1;
      n = cols * rows;
      bx = new Float32Array(n); by = new Float32Array(n); ox = new Float32Array(n); oy = new Float32Array(n); br = new Float32Array(n);
      var x0 = (w - (cols - 1) * spacing) / 2, y0 = (h - (rows - 1) * spacing) / 2, i = 0;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { bx[i] = x0 + c * spacing; by[i] = y0 + r * spacing; i++; }
      stats.dots = n;
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      var buckets = []; for (var l = 0; l < LEVELS; l++) buckets.push([]);
      for (var i = 0; i < n; i++) {
        var lv = Math.min(LEVELS - 1, Math.round(br[i] * (LEVELS - 1)));
        buckets[lv].push(i);
      }
      for (var b = 0; b < LEVELS; b++) {
        var arr = buckets[b]; if (!arr.length) continue;
        var a = BASE + (PEAK - BASE) * (b / (LEVELS - 1));
        ctx.fillStyle = 'rgba(' + ink + ',' + a.toFixed(3) + ')';
        ctx.beginPath();
        var size = b === 0 ? 1.5 : 1.5 + b * 0.12;
        for (var k = 0; k < arr.length; k++) {
          var j = arr[k];
          ctx.rect(bx[j] + ox[j] - size / 2, by[j] + oy[j] - size / 2, size, size);
        }
        ctx.fill();
      }
    }
    function step() {
      var energy = 0, R2 = R * R;
      for (var i = 0; i < n; i++) {
        var tx = 0, ty = 0, tb = 0;
        if (active) {
          var dx = bx[i] - px, dy = by[i] - py, dist2 = dx * dx + dy * dy;
          if (dist2 < R2) {
            var dist = Math.sqrt(dist2) || 1, f = 1 - dist / R; f = f * f;
            tx = dx / dist * f * MAX_DISP; ty = dy / dist * f * MAX_DISP; tb = f;
          }
        }
        ox[i] += (tx - ox[i]) * 0.16; oy[i] += (ty - oy[i]) * 0.16; br[i] += (tb - br[i]) * 0.14;
        energy += Math.abs(tx - ox[i]) + Math.abs(ty - oy[i]) + Math.abs(tb - br[i]);
      }
      return energy;
    }
    function frame(now) {
      raf = 0;
      if (!visible || d.hidden) return;
      if (coarse && last && now - last < 32) { raf = requestAnimationFrame(frame); return; }
      last = now;
      var t0 = performance.now();
      var energy = step();
      draw();
      var cost = performance.now() - t0;
      stats.frames++; stats.total += cost; stats.avg = stats.total / stats.frames;
      if (energy > 0.02 || active) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && !isStatic && visible && !d.hidden) raf = requestAnimationFrame(frame); }
    function point(x, y) {
      if (!rect) return;
      px = x - rect.left; py = y - rect.top;
      active = px > -R && py > -R && px < w + R && py < h + R;
      kick();
    }

    layout();
    function recolor() { readColors(); draw(); }
    d.addEventListener('am:themechange', recolor);
    var mqScheme = matchMedia('(prefers-color-scheme: light)');
    if (mqScheme.addEventListener) mqScheme.addEventListener('change', recolor);
    if ('ResizeObserver' in window) {
      var rzT; new ResizeObserver(function () { clearTimeout(rzT); rzT = setTimeout(layout, 120); }).observe(host);
    }
    if (!isStatic) {
      window.addEventListener('pointermove', function (e) { point(e.clientX, e.clientY); }, { passive: true });
      window.addEventListener('touchstart', function (e) { var p = e.touches[0]; if (p) point(p.clientX, p.clientY); }, { passive: true });
      window.addEventListener('touchmove', function (e) { var p = e.touches[0]; if (p) point(p.clientX, p.clientY); }, { passive: true });
      var off = function () { active = false; kick(); };
      window.addEventListener('touchend', off, { passive: true });
      d.addEventListener('pointerleave', off);
      window.addEventListener('scroll', function () { rect = host.getBoundingClientRect(); }, { passive: true });
      d.addEventListener('visibilitychange', kick);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { rect = host.getBoundingClientRect(); kick(); } }).observe(host);
      }
    }
    return { host: host, stats: stats, redraw: layout, recolor: recolor, isStatic: function () { return isStatic; } };
  }

  /* ---------- Smooth <details>: wrap content in .details__body ---------- */
  function initDetails() {
    d.addEventListener('click', function (e) {
      var sum = e.target.closest && e.target.closest('details > summary');
      if (!sum || reduced()) return;
      var det = sum.parentElement;
      var body = det.querySelector(':scope > .details__body');
      if (!body || det.__anim) return;
      e.preventDefault();
      if (!det.open) {
        det.open = true;
        var hOpen = body.scrollHeight;
        det.__anim = body.animate([{ height: '0px', opacity: 0 }, { height: hOpen + 'px', opacity: 1 }], { duration: 280, easing: EASE_OUT });
        det.__anim.onfinish = det.__anim.oncancel = function () { det.__anim = null; };
      } else {
        var hClose = body.offsetHeight;
        det.__anim = body.animate([{ height: hClose + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 200, easing: EASE_IN });
        det.__anim.onfinish = function () { det.open = false; det.__anim = null; };
        det.__anim.oncancel = function () { det.__anim = null; };
      }
    });
  }

  /* ---------- Scroll progress: [data-scroll-progress] (.progress__bar) ----------
     data-scroll-progress="#article" measures one element; empty = whole page. */
  function initProgress() {
    var bars = $$('[data-scroll-progress]');
    if (!bars.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      bars.forEach(function (bar) {
        var sel = bar.getAttribute('data-scroll-progress'), p;
        if (sel) {
          var tgt = $(sel); if (!tgt) return;
          var r = tgt.getBoundingClientRect(), total = r.height - innerHeight;
          p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : (r.top < 0 ? 1 : 0);
        } else {
          var max = d.documentElement.scrollHeight - innerHeight;
          p = max > 0 ? scrollY / max : 0;
        }
        bar.style.setProperty('--p', p.toFixed(4));
        var pb = bar.closest('[role="progressbar"]');
        if (pb) {
          var v = Math.round(p * 100);
          if (pb.getAttribute('aria-valuenow') !== String(v)) pb.setAttribute('aria-valuenow', String(v));
        }
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ---------- Active TOC: [data-toc] with a[href^="#"] ---------- */
  function initToc() {
    $$('[data-toc]').forEach(function (toc) {
      var links = $$('a[href^="#"]', toc);
      var items = links.map(function (a) { return { a: a, el: d.getElementById(decodeURIComponent(a.hash.slice(1))) }; })
        .filter(function (x) { return x.el; });
      if (!items.length) return;
      var ticking = false, current = null;
      function update() {
        ticking = false;
        var line = (parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 64) + 96;
        var active = items[0];
        items.forEach(function (x) { if (x.el.getBoundingClientRect().top <= line) active = x; });
        if (active === current) return;
        current = active;
        items.forEach(function (x) { if (x === active) x.a.setAttribute('aria-current', 'true'); else x.a.removeAttribute('aria-current'); });
      }
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    });
  }

  /* ---------- Marquee: [data-marquee] > .marquee__viewport > .marquee__track ----------
     Duplicates the track (clones are aria-hidden), runs only while on screen,
     pauses on hover/focus and has a pause button (WCAG 2.2.2). Reduced motion
     shows the static, wrapped list. data-marquee-speed = px per second (40). */
  function initMarquee() {
    $$('[data-marquee]').forEach(function (mq) {
      var track = $('.marquee__track', mq);
      if (!track || reduced()) return;
      $$(':scope > *', track).forEach(function (li) {
        var c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true');
        $$('img', c).forEach(function (img) { img.alt = ''; });
        $$('a, button', c).forEach(function (x) { x.setAttribute('tabindex', '-1'); });
        track.appendChild(c);
      });
      var speed = parseFloat(mq.getAttribute('data-marquee-speed')) || 40;
      var setDur = function () { mq.style.setProperty('--marquee-dur', Math.max(12, track.scrollWidth / 2 / speed) + 's'); };
      setDur(); window.addEventListener('resize', setDur, { passive: true });
      var btn = d.createElement('button');
      btn.type = 'button'; btn.className = 'btn btn--ghost btn--icon marquee__toggle';
      var paint = function () {
        var paused = mq.classList.contains('is-paused');
        btn.setAttribute('aria-pressed', String(paused));
        btn.setAttribute('aria-label', t(paused ? 'marquee_play' : 'marquee_pause', paused ? 'Play' : 'Pause'));
        btn.innerHTML = AM ? AM.icon(paused ? 'play' : 'pause') : '';
      };
      btn.addEventListener('click', function () { mq.classList.toggle('is-paused'); paint(); });
      mq.appendChild(btn); paint();
      mq.classList.add('is-running');
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { mq.classList.toggle('is-offscreen', !en[0].isIntersecting);
          track.style.animationPlayState = en[0].isIntersecting ? '' : 'paused'; }).observe(mq);
      }
    });
  }

  /* ---------- Count: [data-count] on REAL numbers only ----------
     The final text is in the HTML ("8,900"); JS counts up to it once, 700ms. */
  function initCount() {
    if (reduced() || !('IntersectionObserver' in window)) return;
    $$('[data-count]').forEach(function (el) {
      var text = el.textContent.trim();
      var m = /^(\D*)([\d.,]+)(\D*)$/.exec(text);
      if (!m) return;
      var target = parseFloat(m[2].replace(/,/g, '')); if (!isFinite(target)) return;
      var decimals = (m[2].split('.')[1] || '').length;
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return; io.disconnect();
        var t0 = performance.now(), dur = 700;
        el.setAttribute('aria-label', text);
        (function tick(now) {
          var p = Math.min(1, (now - t0) / dur), v = target * expoOut(p);
          el.textContent = m[1] + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + m[3];
          if (p < 1) requestAnimationFrame(tick); else { el.textContent = text; el.removeAttribute('aria-label'); }
        })(t0);
      }, { threshold: 0.6 });
      io.observe(el);
    });
  }

  /* ---------- Magnetic: [data-magnetic="4"] (max px), fine pointer only ----------
     Opt-in. The target never leaves the pointer: the pull is capped at a few px. */
  function initMagnetic() {
    if (!FINE.matches || reduced()) return;
    $$('[data-magnetic]').forEach(function (el) {
      var cap = parseFloat(el.getAttribute('data-magnetic')) || 4;
      el.style.transition = (el.style.transition ? el.style.transition + ', ' : '') + 'translate 280ms ' + EASE_OUT;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.translate = (x * cap).toFixed(2) + 'px ' + (y * cap * 0.6).toFixed(2) + 'px';
      });
      el.addEventListener('pointerleave', function () { el.style.translate = '0px 0px'; });
    });
  }

  /* ---------- GSAP: reveals + parallax; Lenis smooth scroll ---------- */
  var NEVER_DELAY = '.btn--primary, .btn--wa, form, [data-never-delay], [data-hero-cta], .cta-bar, h1';
  function safe(el) { return !el.matches(NEVER_DELAY) && !el.querySelector(NEVER_DELAY); }

  function initReveals() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST) return;
    gsap.registerPlugin(ST);
    var vh = innerHeight;
    $$('[data-reveal]').forEach(function (el) {
      if (!safe(el) || el.getBoundingClientRect().top < vh * 0.92) return;
      gsap.set(el, { opacity: 0, y: 16 });
      ST.create({ trigger: el, start: 'top 88%', once: true,
        onEnter: function () { gsap.to(el, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out', clearProps: 'opacity,transform' }); } });
    });
    $$('[data-reveal-stagger]').forEach(function (group) {
      if (group.getBoundingClientRect().top < vh * 0.92) return;
      var kids = Array.prototype.filter.call(group.children, safe);
      if (!kids.length) return;
      var each = Math.min(0.06, 0.36 / kids.length);
      gsap.set(kids, { opacity: 0, y: 16 });
      ST.create({ trigger: group, start: 'top 85%', once: true,
        onEnter: function () { gsap.to(kids, { opacity: 1, y: 0, duration: 0.45, stagger: each, ease: 'expo.out', clearProps: 'opacity,transform' }); } });
    });
    if (FINE.matches && matchMedia('(min-width: 1024px)').matches) {
      $$('[data-parallax]').forEach(function (img) {
        var amt = Math.min(0.2, parseFloat(img.getAttribute('data-parallax')) || 0.08);
        gsap.set(img, { scale: 1 + amt, transformOrigin: '50% 50%' });
        gsap.fromTo(img, { yPercent: -amt * 40 }, { yPercent: amt * 40, ease: 'none',
          scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }
    /* Content loaded late (fonts, images) shifts trigger positions */
    window.addEventListener('load', function () { ST.refresh(); });
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { ST.refresh(); });
  }

  function headerOffset() {
    var h = $('.site-header');
    return (h ? h.offsetHeight : 0) + 16;
  }

  function initLenis() {
    var Lenis = window.Lenis;
    if (!Lenis) return;
    var lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, autoRaf: false, anchors: false });
    Motion.lenis = lenis;
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (gsap && ST) {
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(time) { lenis.raf(time); requestAnimationFrame(raf); })(performance.now());
    }
    d.addEventListener('am:overlay', function (e) { if (e.detail && e.detail.open) lenis.stop(); else lenis.start(); });
    /* Anchor links: offset by the header; long jumps (>3 viewports) are immediate */
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || a.target === '_blank') return;
      var url; try { url = new URL(a.href); } catch (err) { return; }
      if (url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
      var id = decodeURIComponent(url.hash.slice(1));
      var target = id ? d.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      var dist = Math.abs(target.getBoundingClientRect().top);
      var immediate = dist > innerHeight * 3;
      lenis.scrollTo(target, { offset: -headerOffset(), immediate: immediate, duration: Math.min(0.8, 0.35 + dist / 4000),
        onComplete: function () {
          if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        } });
      if (history.pushState) history.pushState(null, '', url.hash);
    });
  }

  function initLibraries() {
    if (reduced()) return;
    var wantGsap = !!$('[data-reveal], [data-reveal-stagger], [data-parallax]');
    var wantLenis = FINE.matches && !inApp() && !root.hasAttribute('data-no-lenis');
    if (!wantGsap && !wantLenis) return;
    load(LIBS.gsap).then(function () { return load(LIBS.st); })
      .then(function () { initReveals(); })
      .catch(function () { /* page stays static and fully visible */ })
      .then(function () { if (wantLenis) return load(LIBS.lenis).then(initLenis); })
      .catch(function () { /* native scrolling */ });
  }

  /* ---------- Boot ---------- */
  function boot(am) {
    AM = am || window.AM || null;
    $$('[data-prompt-demo]').forEach(function (el) { var demo = PromptDemo(el); if (demo) Motion.demos.push(demo); });
    $$('[data-field]').forEach(function (el) { var f = DotField(el); if (f) Motion.fields.push(f); });
    Motion.recolor = function () { Motion.fields.forEach(function (f) { f.recolor(); }); };
    initDetails();
    initProgress();
    initToc();
    initMarquee();
    initCount();
    initMagnetic();
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };
    if (d.readyState === 'complete') idle(initLibraries);
    else window.addEventListener('load', function () { idle(initLibraries); });
  }
  if (window.AM && window.AM.ready) boot(window.AM);
  else {
    var booted = false;
    (window.AMQ = window.AMQ || []).push(function (am) { if (!booted) { booted = true; boot(am); } });
    /* site.js missing: run on our own after DOM is ready */
    d.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () { if (!booted) { booted = true; boot(null); } }, 0);
    });
  }
})();
