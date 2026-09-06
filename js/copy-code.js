(function () {
  const figures = document.querySelectorAll('.article-content figure.highlight');
  figures.forEach(function (figure) {
    const classes = Array.from(figure.classList).filter(function (name) { return name !== 'highlight'; });
    figure.dataset.language = classes[0] || 'code';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy-code';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', '复制代码');

    button.addEventListener('click', async function () {
      const code = figure.querySelector('.code pre') || figure.querySelector('pre');
      const text = code ? code.textContent : '';
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
      } catch (_) {
        button.textContent = 'Select code';
      }
      window.setTimeout(function () { button.textContent = 'Copy'; }, 1600);
    });

    figure.appendChild(button);
  });
})();
