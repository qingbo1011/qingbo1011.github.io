(function () {
  const toggle = document.querySelector('.toc-toggle');
  const panel = document.querySelector('#article-toc');
  if (!toggle || !panel) return;

  const closeButton = panel.querySelector('.toc-panel__close');
  const scrim = document.querySelector('.toc-scrim');
  const currentLabel = toggle.querySelector('[data-current-section]');
  const links = Array.from(panel.querySelectorAll('.toc-link'));
  const sections = links
    .map(function (link) {
      let target = null;
      try { target = document.querySelector(decodeURIComponent(link.hash)); } catch (_) {}
      return { link, target };
    })
    .filter(function (item) { return item.target; });

  function setOpen(open, restoreFocus) {
    document.body.classList.toggle('toc-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) window.setTimeout(function () { if (closeButton) closeButton.focus(); }, 30);
    if (!open && restoreFocus) toggle.focus();
  }

  function updateCurrent() {
    const activationLine = Math.min(window.innerHeight * 0.45, 360);
    const current = sections.slice().reverse().find(function (item) {
      return item.target.getBoundingClientRect().top <= activationLine;
    }) || sections[0];

    sections.forEach(function (item) {
      item.link.classList.toggle('is-current', item === current);
    });

    if (current && currentLabel) {
      const label = current.link.textContent.trim();
      currentLabel.textContent = label.split(/\s+/)[0] || '•';
    }
  }

  toggle.addEventListener('click', function () { setOpen(true); });
  if (closeButton) closeButton.addEventListener('click', function () { setOpen(false, true); });
  if (scrim) scrim.addEventListener('click', function () { setOpen(false, true); });
  links.forEach(function (link) {
    link.addEventListener('click', function () { setOpen(false, true); });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.body.classList.contains('toc-open')) setOpen(false, true);
  });
  window.addEventListener('scroll', updateCurrent, { passive: true });
  updateCurrent();
})();
