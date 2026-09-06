(function () {
  const root = document.documentElement;
  const button = document.querySelector('.mode-button');
  if (!button) return;

  function apply(mode, persist) {
    root.dataset.theme = mode;
    button.setAttribute('aria-label', mode === 'dark' ? '切换为亮色模式' : '切换为暗色模式');
    if (persist) {
      try { localStorage.setItem('quinn-theme-mode', mode); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('quinn:themechange', { detail: { mode } }));
  }

  apply(root.dataset.theme === 'dark' ? 'dark' : 'light', false);
  button.addEventListener('click', function () {
    apply(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
})();
