/* ═══════════════════════════════════════════════════════════════
   📊 متتبّع مصادر الزيارات — AI Visit Tracker
   يسجّل كل زيارة للموقع في Google Sheet مع مصدرها:
   chatgpt / gemini / perplexity / claude / copilot ... أو direct

   ✏️ خطوة واحدة للتفعيل:
   اتبع تعليمات ملف tracking-apps-script.gs (5 دقائق)
   ثم الصق رابط النشر هنا بين علامتي التنصيص:

   إضافة (2026-10): window.aiTrack(event, props) يرسل أحداثاً إلى نفس الرابط
   بنفس الحقول الأصلية {source, page, referrer, lang, ua} مع حقول إضافية فقط:
   {event, props, vid, sid, ts, utm_medium, utm_campaign, utm_content, state}.
   زيارة الصفحة ما زالت تُرسل تلقائياً، الآن مع event:"page_view".
   لا تُرسل أي بيانات شخصية (أسماء، إيميلات، أرقام) في props.
═══════════════════════════════════════════════════════════════ */
const TRACKER_URL = "https://script.google.com/macros/s/AKfycbzcJ0agnABb_GvGBWGJKbRa1NSrs_GxICWMB8nsWEMP1WVrQhi672DHSnXxWSMy6TnkBQ/exec";

(function () {
  if (!TRACKER_URL) return; // التتبع متوقف حتى تضع الرابط
  try {
    // 1) المصدر من utm_source (مثل ?utm_source=chatgpt.com)
    const params = new URLSearchParams(location.search);
    let source = (params.get("utm_source") || "").toLowerCase().trim();

    // 1b) إضافة: مصدر محفوظ من صفحات التحويل (?ref=) أو رابط داخلي (?from=)
    if (!source && params.get("ref")) source = "ref:" + params.get("ref").toLowerCase().trim();
    if (!source && params.get("from")) source = "internal:" + params.get("from").toLowerCase().trim();

    // 2) إن لم يوجد utm — نكشف المصدر من الرابط المُحيل (referrer)
    const ref = document.referrer || "";
    if (!source && ref) {
      let host = "";
      try { host = new URL(ref).hostname.replace(/^www\./, ""); } catch (e) {}
      const AI_MAP = {
        "chatgpt.com": "chatgpt", "chat.openai.com": "chatgpt", "openai.com": "chatgpt",
        "gemini.google.com": "gemini", "bard.google.com": "gemini",
        "perplexity.ai": "perplexity",
        "claude.ai": "claude",
        "copilot.microsoft.com": "copilot",
        "you.com": "you.com",
        "chat.deepseek.com": "deepseek",
        "grok.com": "grok", "x.ai": "grok",
        "meta.ai": "meta-ai",
        "google.com": "google", "bing.com": "bing", "duckduckgo.com": "duckduckgo",
        "facebook.com": "facebook", "instagram.com": "instagram",
        "linkedin.com": "linkedin", "t.co": "twitter-x", "wa.me": "whatsapp",
        // إضافة
        "l.instagram.com": "instagram", "lm.facebook.com": "facebook", "l.facebook.com": "facebook",
        "lnkd.in": "linkedin", "api.whatsapp.com": "whatsapp", "web.whatsapp.com": "whatsapp",
        "nciuae.com": "nci",
      };
      source = AI_MAP[host] || (host ? "ref:" + host : "");
    }
    if (!source) source = "direct";

    // تنظيف: chatgpt.com -> chatgpt وهكذا
    source = source.replace(/\.(com|ai|net|org)$/, "");

    // إضافة: معرّف زائر وجلسة عشوائيان (بدون بيانات شخصية)
    const rid = () => Math.random().toString(36).slice(2, 10);
    let vid = "", sid = "";
    try { vid = localStorage.getItem("am_vid") || ""; if (!vid) { vid = rid(); localStorage.setItem("am_vid", vid); } } catch (e) {}
    try { sid = sessionStorage.getItem("am_sid") || ""; if (!sid) { sid = rid().slice(0, 6); sessionStorage.setItem("am_sid", sid); } } catch (e) {}

    function send(event, props) {
      const payload = JSON.stringify({
        source: source,
        page: location.pathname + location.search,
        referrer: ref,
        lang: document.documentElement.lang || navigator.language || "",
        ua: navigator.userAgent,
        // حقول إضافية
        event: event || "page_view",
        props: JSON.stringify(props || {}),
        vid: vid,
        sid: sid,
        ts: Date.now(),
        utm_medium: params.get("utm_medium") || "",
        utm_campaign: params.get("utm_campaign") || "",
        utm_content: params.get("utm_content") || "",
        state: document.documentElement.getAttribute("data-workshop-state") || "",
      });
      // إرسال خفيف لا يؤثر على سرعة الصفحة
      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACKER_URL, payload);
      } else {
        fetch(TRACKER_URL, { method: "POST", body: payload, keepalive: true });
      }
    }

    // إضافة: واجهة الأحداث للصفحات (assets/js/site.js تستدعيها عبر AM.track)
    window.aiTrack = function (event, props) { try { send(String(event || "event"), props); } catch (e) {} };
    window.amTrack = window.aiTrack;

    send("page_view", {
      motion: matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full",
    });
  } catch (e) { /* التتبع لا يجب أن يكسر الموقع أبداً */ }
})();
