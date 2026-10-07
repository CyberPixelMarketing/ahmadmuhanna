/* =====================================================================
   ahmadmuhanna.com · theme-boot.js  (REFERENCE COPY, do not load as a file)

   Pages paste the minified one-liner below INLINE in <head>, before the
   site.css <link>, so <html data-theme> is set before first paint (no flash
   of the wrong theme). A blocking external request would cost more than the
   ~260 bytes it saves. It also adds the `js` class, so it replaces the old
   <script>document.documentElement.classList.add('js')</script> line.

   Resolution: stored choice (localStorage 'am-theme': 'light' | 'dark') wins,
   otherwise the OS preference (prefers-color-scheme), otherwise dark.
   site.js (AM.theme) takes over after load: toggle, storage, OS changes,
   <meta name="theme-color">, and the `am:themechange` event.

   Paste exactly:
<script>(function(e){var t;try{t=localStorage.getItem("am-theme")}catch(n){}if(t!="light"&&t!="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";e.setAttribute("data-theme",t);e.classList.add("js")})(document.documentElement)</script>
   ===================================================================== */
(function (root) {
  var theme;
  try { theme = localStorage.getItem('am-theme'); } catch (err) { /* storage blocked */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  root.setAttribute('data-theme', theme);
  root.classList.add('js');
})(document.documentElement);
