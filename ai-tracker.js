/* ═══════════════════════════════════════════════════════════════
   📊 متتبّع مصادر الزيارات — AI Visit Tracker
   يسجّل كل زيارة للموقع في Google Sheet مع مصدرها:
   chatgpt / gemini / perplexity / claude / copilot ... أو direct

   ✏️ خطوة واحدة للتفعيل:
   اتبع تعليمات ملف tracking-apps-script.gs (5 دقائق)
   ثم الصق رابط النشر هنا بين علامتي التنصيص:
═══════════════════════════════════════════════════════════════ */
const TRACKER_URL = "";

(function () {
  if (!TRACKER_URL) return; // التتبع متوقف حتى تضع الرابط
  try {
    // 1) المصدر من utm_source (مثل ?utm_source=chatgpt.com)
    const params = new URLSearchParams(location.search);
    let source = (params.get("utm_source") || "").toLowerCase().trim();

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
      };
      source = AI_MAP[host] || (host ? "ref:" + host : "");
    }
    if (!source) source = "direct";

    // تنظيف: chatgpt.com -> chatgpt وهكذا
    source = source.replace(/\.(com|ai|net|org)$/, "");

    const payload = JSON.stringify({
      source: source,
      page: location.pathname + location.search,
      referrer: ref,
      lang: document.documentElement.lang || navigator.language || "",
      ua: navigator.userAgent,
    });

    // إرسال خفيف لا يؤثر على سرعة الصفحة
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACKER_URL, payload);
    } else {
      fetch(TRACKER_URL, { method: "POST", body: payload, keepalive: true });
    }
  } catch (e) { /* التتبع لا يجب أن يكسر الموقع أبداً */ }
})();
