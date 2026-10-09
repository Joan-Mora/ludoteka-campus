(function () {
  try {
    var saved = localStorage.getItem('lk_theme');
    var dark = saved === 'dark' || ((!saved || saved === 'system') && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
