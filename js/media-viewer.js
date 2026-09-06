(function () {
  const article = document.querySelector('.article-content');
  const dialog = document.querySelector('[data-media-viewer]');
  if (!article || !dialog || typeof dialog.showModal !== 'function') return;

  const stage = dialog.querySelector('[data-media-stage]');
  const canvas = dialog.querySelector('[data-media-canvas]');
  const kindLabel = dialog.querySelector('[data-media-kind]');
  const positionLabel = dialog.querySelector('[data-media-position]');
  const scaleLabel = dialog.querySelector('[data-media-scale]');
  const caption = dialog.querySelector('[data-media-caption]');
  const downloadButton = dialog.querySelector('[data-media-action="download"]');
  const pointers = new Map();
  const state = {
    target: null,
    kind: null,
    naturalWidth: 1,
    naturalHeight: 1,
    baseWidth: 1,
    baseHeight: 1,
    scale: 1,
    minScale: .5,
    maxScale: 6,
    panX: 0,
    panY: 0,
    drag: null,
    pinch: null,
    lastTrigger: null,
    downloadUrl: null
  };

  function allTargets() {
    return Array.from(article.querySelectorAll('[data-media-viewer-target]'));
  }

  function mermaidAction(action, label, icon) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mermaid-panel__action';
    button.dataset.mermaidAction = action;
    button.dataset.label = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = icon;
    return button;
  }

  function decorateDiagram(diagram, index) {
    diagram.dataset.mediaViewerTarget = 'diagram';
    diagram.tabIndex = diagram.hasAttribute('tabindex') ? diagram.tabIndex : 0;
    if (!diagram.hasAttribute('role')) diagram.setAttribute('role', 'button');
    if (!diagram.hasAttribute('aria-label')) {
      diagram.setAttribute('aria-label', '放大查看 Mermaid 图 ' + (index + 1));
    }
    if (diagram.parentElement && diagram.parentElement.classList.contains('mermaid-panel')) return;

    const panel = document.createElement('div');
    const actions = document.createElement('div');
    panel.className = 'mermaid-panel';
    actions.className = 'mermaid-panel__actions';
    actions.setAttribute('role', 'toolbar');
    actions.setAttribute('aria-label', 'Mermaid 图表操作');
    actions.append(
      mermaidAction(
        'copy',
        '复制 Mermaid 源码',
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>'
      ),
      mermaidAction(
        'expand',
        '展开 Mermaid 图表',
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path></svg>'
      )
    );
    diagram.before(panel);
    panel.append(diagram, actions);
  }

  function decorateTargets() {
    const images = article.querySelectorAll('img:not([data-no-zoom])');
    images.forEach(function (image) {
      image.dataset.mediaViewerTarget = 'image';
      image.tabIndex = image.hasAttribute('tabindex') ? image.tabIndex : 0;
      if (!image.hasAttribute('role')) image.setAttribute('role', 'button');
      if (!image.hasAttribute('aria-label')) {
        image.setAttribute('aria-label', '放大查看' + (image.alt ? '：' + image.alt : '图片'));
      }
    });

    const diagrams = article.querySelectorAll('.mermaid:not([data-no-zoom])');
    diagrams.forEach(decorateDiagram);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('copy unavailable');
  }

  async function copyMermaid(button, diagram) {
    const source = diagram.dataset.mermaidSource || '';
    if (!source) return;
    const originalLabel = '复制 Mermaid 源码';
    try {
      await copyText(source);
      button.dataset.copyState = 'done';
      button.dataset.label = '已复制';
      button.setAttribute('aria-label', '已复制 Mermaid 源码');
    } catch (_) {
      button.dataset.copyState = 'error';
      button.dataset.label = '复制失败';
      button.setAttribute('aria-label', '复制失败');
    }
    window.setTimeout(function () {
      delete button.dataset.copyState;
      button.dataset.label = originalLabel;
      button.setAttribute('aria-label', originalLabel);
    }, 1600);
  }

  function targetFromEvent(event) {
    const target = event.target.closest('[data-media-viewer-target]');
    return target && article.contains(target) ? target : null;
  }

  function mediaSize(target, kind) {
    if (kind === 'image') {
      const rect = target.getBoundingClientRect();
      return {
        width: target.naturalWidth || rect.width || 1,
        height: target.naturalHeight || rect.height || 1
      };
    }

    const svg = target.querySelector('svg');
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox && svg.viewBox.baseVal;
    return {
      width: viewBox && viewBox.width ? viewBox.width : (rect.width || 1),
      height: viewBox && viewBox.height ? viewBox.height : (rect.height || 1)
    };
  }

  function cloneMedia(target, kind) {
    if (kind === 'image') {
      const image = document.createElement('img');
      image.src = target.currentSrc || target.src;
      image.alt = target.alt || '';
      image.draggable = false;
      return image;
    }

    const source = target.querySelector('svg');
    if (!source) return null;
    const svg = source.cloneNode(true);
    svg.removeAttribute('style');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('aria-hidden', 'true');
    svg.removeAttribute('role');
    return svg;
  }

  function mediaCaption(target, kind) {
    if (kind === 'image') return target.alt || '';
    const anchor = target.closest('.mermaid-panel') || target;
    let heading = anchor.previousElementSibling;
    while (heading && !/^H[2-4]$/.test(heading.tagName)) heading = heading.previousElementSibling;
    if (heading) return heading.textContent.trim();
    return target.getAttribute('aria-label') || 'Mermaid diagram';
  }

  function clearDownload() {
    if (state.downloadUrl) URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = null;
    downloadButton.hidden = true;
    downloadButton.removeAttribute('href');
    downloadButton.removeAttribute('download');
  }

  function prepareDiagramDownload(target) {
    clearDownload();
    const source = target.querySelector('svg');
    if (!source) return;
    const svg = source.cloneNode(true);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const serialized = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const name = mediaCaption(target, 'diagram')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'qingbo-lab-diagram';
    state.downloadUrl = url;
    downloadButton.href = url;
    downloadButton.download = name + '.svg';
    downloadButton.hidden = false;
  }

  function applyTransform() {
    canvas.style.width = state.baseWidth + 'px';
    canvas.style.height = state.baseHeight + 'px';
    canvas.style.marginLeft = (-state.baseWidth / 2) + 'px';
    canvas.style.marginTop = (-state.baseHeight / 2) + 'px';
    canvas.style.transform = 'translate3d(' + state.panX + 'px,' + state.panY + 'px,0) scale(' + state.scale + ')';
    scaleLabel.textContent = Math.round(state.scale * 100) + '%';
  }

  function fitMedia() {
    if (!state.target) return;
    const horizontalInset = window.innerWidth <= 720 ? 24 : 72;
    const verticalInset = window.innerWidth <= 720 ? 24 : 56;
    const availableWidth = Math.max(1, stage.clientWidth - horizontalInset);
    const availableHeight = Math.max(1, stage.clientHeight - verticalInset);
    const fit = Math.min(
      availableWidth / state.naturalWidth,
      availableHeight / state.naturalHeight,
      state.kind === 'diagram' ? 1.2 : 1
    );
    state.baseWidth = Math.max(1, state.naturalWidth * fit);
    state.baseHeight = Math.max(1, state.naturalHeight * fit);
    state.scale = 1;
    state.panX = 0;
    state.panY = 0;
    state.maxScale = state.kind === 'diagram'
      ? 8
      : Math.max(3, Math.min(8, (state.naturalWidth / state.baseWidth) * 2));
    applyTransform();
  }

  function zoomTo(nextScale, clientX, clientY) {
    const oldScale = state.scale;
    const newScale = Math.min(state.maxScale, Math.max(state.minScale, nextScale));
    if (newScale === oldScale) return;
    const rect = stage.getBoundingClientRect();
    const pointX = typeof clientX === 'number' ? clientX - rect.left - rect.width / 2 : 0;
    const pointY = typeof clientY === 'number' ? clientY - rect.top - rect.height / 2 : 0;
    const ratio = newScale / oldScale;
    state.panX = pointX - (pointX - state.panX) * ratio;
    state.panY = pointY - (pointY - state.panY) * ratio;
    state.scale = newScale;
    applyTransform();
  }

  function openTarget(target) {
    const kind = target.dataset.mediaViewerTarget;
    const size = mediaSize(target, kind);
    const media = cloneMedia(target, kind);
    if (!size || !media) return;

    const targets = allTargets();
    state.target = target;
    state.kind = kind;
    state.naturalWidth = size.width;
    state.naturalHeight = size.height;
    state.lastTrigger = target;
    dialog.dataset.mediaKind = kind;
    kindLabel.textContent = kind === 'diagram' ? 'Diagram' : 'Image';
    positionLabel.textContent = String(Math.max(0, targets.indexOf(target)) + 1).padStart(2, '0');
    caption.textContent = mediaCaption(target, kind);
    if (kind === 'diagram') prepareDiagramDownload(target);
    else clearDownload();
    canvas.replaceChildren(media);
    document.body.classList.add('media-viewer-open');
    dialog.showModal();
    requestAnimationFrame(function () {
      fitMedia();
      stage.focus({ preventScroll: true });
    });
  }

  function closeViewer() {
    if (dialog.open) dialog.close();
  }

  function clearViewer() {
    document.body.classList.remove('media-viewer-open');
    clearDownload();
    pointers.clear();
    stage.classList.remove('is-dragging');
    canvas.replaceChildren();
    const trigger = state.lastTrigger;
    state.target = null;
    state.kind = null;
    state.drag = null;
    state.pinch = null;
    if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
  }

  function pointerCenter(points) {
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    };
  }

  function pointerDistance(points) {
    return Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  }

  function beginSinglePointer(pointer) {
    state.drag = {
      x: pointer.x,
      y: pointer.y,
      panX: state.panX,
      panY: state.panY
    };
    state.pinch = null;
  }

  article.addEventListener('click', function (event) {
    const actionButton = event.target.closest('[data-mermaid-action]');
    if (actionButton && article.contains(actionButton)) {
      event.preventDefault();
      event.stopPropagation();
      const panel = actionButton.closest('.mermaid-panel');
      const diagram = panel && panel.querySelector('.mermaid');
      if (!diagram) return;
      if (actionButton.dataset.mermaidAction === 'copy') copyMermaid(actionButton, diagram);
      if (actionButton.dataset.mermaidAction === 'expand') openTarget(diagram);
      return;
    }
    const target = targetFromEvent(event);
    if (!target) return;
    event.preventDefault();
    openTarget(target);
  });

  article.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = targetFromEvent(event);
    if (!target) return;
    event.preventDefault();
    openTarget(target);
  });

  dialog.addEventListener('click', function (event) {
    const button = event.target.closest('[data-media-action]');
    if (!button) {
      if (event.target === dialog) closeViewer();
      return;
    }
    const action = button.dataset.mediaAction;
    if (action === 'close') closeViewer();
    if (action === 'reset') fitMedia();
    if (action === 'zoom-in') zoomTo(state.scale * 1.25);
    if (action === 'zoom-out') zoomTo(state.scale / 1.25);
  });

  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    closeViewer();
  });

  dialog.addEventListener('close', clearViewer);

  stage.addEventListener('wheel', function (event) {
    event.preventDefault();
    zoomTo(state.scale * (event.deltaY < 0 ? 1.14 : 1 / 1.14), event.clientX, event.clientY);
  }, { passive: false });

  stage.addEventListener('dblclick', function (event) {
    event.preventDefault();
    if (Math.abs(state.scale - 1) > .05 || state.panX || state.panY) fitMedia();
    else zoomTo(2, event.clientX, event.clientY);
  });

  stage.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.classList.add('is-dragging');

    if (pointers.size === 1) {
      beginSinglePointer({ x: event.clientX, y: event.clientY });
    } else if (pointers.size === 2) {
      const points = Array.from(pointers.values());
      state.pinch = {
        distance: Math.max(1, pointerDistance(points)),
        center: pointerCenter(points),
        scale: state.scale,
        panX: state.panX,
        panY: state.panY
      };
      state.drag = null;
    }
  });

  stage.addEventListener('pointermove', function (event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2 && state.pinch) {
      const points = Array.from(pointers.values());
      const center = pointerCenter(points);
      const nextScale = Math.min(
        state.maxScale,
        Math.max(state.minScale, state.pinch.scale * pointerDistance(points) / state.pinch.distance)
      );
      const ratio = nextScale / state.pinch.scale;
      const rect = stage.getBoundingClientRect();
      const startX = state.pinch.center.x - rect.left - rect.width / 2;
      const startY = state.pinch.center.y - rect.top - rect.height / 2;
      const currentX = center.x - rect.left - rect.width / 2;
      const currentY = center.y - rect.top - rect.height / 2;
      state.panX = currentX - (startX - state.pinch.panX) * ratio;
      state.panY = currentY - (startY - state.pinch.panY) * ratio;
      state.scale = nextScale;
      applyTransform();
      return;
    }

    if (pointers.size === 1 && state.drag) {
      state.panX = state.drag.panX + event.clientX - state.drag.x;
      state.panY = state.drag.panY + event.clientY - state.drag.y;
      applyTransform();
    }
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) beginSinglePointer(Array.from(pointers.values())[0]);
    if (!pointers.size) {
      state.drag = null;
      state.pinch = null;
      stage.classList.remove('is-dragging');
    }
  }

  stage.addEventListener('pointerup', releasePointer);
  stage.addEventListener('pointercancel', releasePointer);

  stage.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeViewer();
      return;
    }
    const step = event.shiftKey ? 80 : 36;
    if (event.key === '+' || event.key === '=') zoomTo(state.scale * 1.25);
    else if (event.key === '-') zoomTo(state.scale / 1.25);
    else if (event.key === '0') fitMedia();
    else if (event.key === 'ArrowLeft') state.panX += step;
    else if (event.key === 'ArrowRight') state.panX -= step;
    else if (event.key === 'ArrowUp') state.panY += step;
    else if (event.key === 'ArrowDown') state.panY -= step;
    else return;
    event.preventDefault();
    applyTransform();
  });

  let resizeFrame = 0;
  window.addEventListener('resize', function () {
    if (!dialog.open) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fitMedia);
  });

  decorateTargets();
})();
