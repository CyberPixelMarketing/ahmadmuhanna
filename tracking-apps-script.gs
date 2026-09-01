/**
 * ═══════════════════════════════════════════════════════════════════
 *  📊 سكربت تتبّع الزيارات — يسجّل كل زيارة في Google Sheet
 *  Visit tracker — appends every website visit to your Google Sheet
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ماذا يفعل؟
 *  كل زيارة لموقعك تُسجَّل صفاً جديداً في الشيت:
 *  التاريخ والوقت · المصدر (chatgpt / gemini / direct ...) · الصفحة · المُحيل · اللغة · المتصفح
 *
 *  ─────────── خطوات التركيب (5 دقائق، مرة واحدة) ───────────
 *
 *  1) أنشئ Google Sheet جديد من: https://sheets.new
 *     سمّه مثلاً: "زيارات الموقع — Ahmad AI"
 *     وانسخ معرّف الشيت من رابطه:
 *     https://docs.google.com/spreadsheets/d/[[ هذا هو المعرّف ]]/edit
 *
 *  2) الصق المعرّف في السطر SHEET_ID بالأسفل 👇
 *
 *  3) افتح https://script.google.com بنفس حساب جوجل → مشروع جديد
 *     الصق هذا الملف كاملاً واحفظ
 *
 *  4) نشر (Deploy) → عملية نشر جديدة → تطبيق ويب (Web app)
 *     - التنفيذ بصفتي: أنا (Me)
 *     - من يمكنه الوصول: أي شخص (Anyone)  ← مهم
 *     → نشر → وافق على الأذونات → انسخ رابط /exec
 *
 *  5) افتح ملف ai-tracker.js وضع الرابط في TRACKER_URL
 *     ثم ارفع ai-tracker.js مع ملفات موقعك — انتهى ✅
 *
 *  ─────────── كيف تقرأ النتائج؟ ───────────
 *  شغّل الدالة setupSummary (مرة واحدة من زر Run بالأعلى بعد اختيارها)
 *  وستُنشأ لك ورقة "الملخص" فيها عدد الزوار من كل مصدر تلقائياً.
 * ═══════════════════════════════════════════════════════════════════
 */

// ✏️ ضع معرّف الـ Google Sheet هنا:
const SHEET_ID = "PASTE_YOUR_SHEET_ID_HERE";

const TAB_VISITS = "الزيارات";
const TAB_SUMMARY = "الملخص";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents || "{}");
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(TAB_VISITS);
    if (!sh) {
      sh = ss.insertSheet(TAB_VISITS);
    }
    if (sh.getLastRow() === 0) {
      sh.appendRow(["التاريخ والوقت", "المصدر", "الصفحة", "الرابط المُحيل", "اللغة", "المتصفح/الجهاز"]);
      sh.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#F1F8E9");
      sh.setFrozenRows(1);
    }
    sh.appendRow([
      new Date(),
      String(d.source || "direct"),
      String(d.page || ""),
      String(d.referrer || ""),
      String(d.lang || ""),
      String(d.ua || "").slice(0, 250),
    ]);
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("err:" + err);
  }
}

/**
 * شغّلها مرة واحدة يدوياً: تنشئ ورقة "الملخص" بعدد الزوار لكل مصدر
 * (تتحدث تلقائياً لأنها معادلات حية)
 */
function setupSummary() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sum = ss.getSheetByName(TAB_SUMMARY);
  if (!sum) sum = ss.insertSheet(TAB_SUMMARY);
  sum.clear();
  sum.getRange("A1").setValue("عدد الزوار حسب المصدر").setFontWeight("bold").setFontSize(14);
  sum.getRange("A3").setFormula(
    '=IFERROR(QUERY(' + TAB_VISITS + '!A:B,"select B, count(A) where B is not null group by B order by count(A) desc label B \'المصدر\', count(A) \'عدد الزيارات\'",1),"لا توجد زيارات بعد")'
  );
  sum.getRange("D1").setValue("زوار الذكاء الاصطناعي فقط").setFontWeight("bold").setFontSize(14);
  sum.getRange("D3").setFormula(
    '=IFERROR(QUERY(' + TAB_VISITS + '!A:B,"select B, count(A) where B matches \'chatgpt|gemini|perplexity|claude|copilot|deepseek|grok|meta-ai|you.com\' group by B order by count(A) desc label B \'مصدر AI\', count(A) \'عدد الزيارات\'",1),"لا زيارات من AI بعد")'
  );
  sum.getRange("G1").setValue("الزيارات آخر 7 أيام").setFontWeight("bold").setFontSize(14);
  sum.getRange("G3").setFormula(
    '=IFERROR(COUNTIF(' + TAB_VISITS + '!A:A,">"&(NOW()-7)),"0")'
  );
  SpreadsheetApp.flush();
}
