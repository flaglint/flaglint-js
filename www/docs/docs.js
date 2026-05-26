/* FlagLint Docs — shared JS */

// ── COPY BUTTONS ──────────────────────────────────────────────
document.querySelectorAll('.copy-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var targetId = btn.getAttribute('data-target');
    var text;
    if (targetId) {
      var el = document.getElementById(targetId);
      text = el ? el.textContent : '';
    } else {
      var pre = btn.closest('.code-block').querySelector('pre');
      text = pre ? pre.textContent : '';
    }
    navigator.clipboard.writeText(text.trim()).then(function () {
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.color = '#00d97e';
      setTimeout(function () { btn.textContent = orig; btn.style.color = ''; }, 2000);
    }).catch(function () {
      btn.textContent = 'Failed';
      setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
    });
  });
});

// ── SIDEBAR ACTIVE LINK ───────────────────────────────────────
(function () {
  var path = window.location.pathname.replace(/\/$/, '');
  document.querySelectorAll('.sidebar-nav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (!href) return;
    // Normalise: strip trailing slash and .html
    var norm = href.replace(/\/$/, '').replace(/\.html$/, '');
    var normPath = path.replace(/\.html$/, '');
    if (normPath === norm || normPath.endsWith(norm)) {
      a.classList.add('active');
    }
  });
})();
