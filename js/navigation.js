(function () {
  const menuButton = document.querySelector('.menu-button');
  const nav = document.querySelector('#site-nav');
  if (!menuButton || !nav) return;

  menuButton.addEventListener('click', function () {
    const open = nav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  });

  nav.addEventListener('click', function (event) {
    if (!event.target.closest('a')) return;
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '打开导航');
  });
})();
