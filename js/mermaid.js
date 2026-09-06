(function () {
  const nodes = Array.from(document.querySelectorAll('.article-content .mermaid'));
  const source = document.body.dataset.mermaidSrc;
  if (!nodes.length || !source) return;

  nodes.forEach(function (node) { node.dataset.mermaidSource = node.textContent.trim(); });

  function render() {
    if (!window.mermaid) return;
    nodes.forEach(function (node) {
      node.removeAttribute('data-processed');
      node.textContent = node.dataset.mermaidSource;
      node.classList.remove('mermaid-error');
    });
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default'
    });
    window.mermaid.run({ nodes }).catch(function () {
      nodes.forEach(function (node) {
        if (!node.querySelector('svg')) node.classList.add('mermaid-error');
      });
    });
  }

  const script = document.createElement('script');
  script.src = source;
  script.async = true;
  script.addEventListener('load', render);
  script.addEventListener('error', function () { nodes.forEach(function (node) { node.classList.add('mermaid-error'); }); });
  document.head.appendChild(script);
  window.addEventListener('quinn:themechange', function () { if (window.mermaid) render(); });
})();
