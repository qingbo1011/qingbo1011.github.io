(function () {
  const dialog = document.querySelector('#search-dialog');
  const openButtons = document.querySelectorAll('.search-button');
  if (!dialog || !openButtons.length) return;

  const input = dialog.querySelector('#search-input');
  const closeButton = dialog.querySelector('.search-dialog__close');
  const retryButton = dialog.querySelector('.search-dialog__retry');
  const status = dialog.querySelector('.search-dialog__status');
  const results = dialog.querySelector('.search-results');
  const indexTimeout = 8000;
  let entriesPromise;
  let debounceTimer;
  let searchRevision = 0;

  function normalize(value) {
    return String(value || '').toLocaleLowerCase();
  }

  function normalizeList(value) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }

  function prepareEntry(entry) {
    const prepared = {
      title: String(entry.title || ''),
      url: String(entry.url || ''),
      date: String(entry.date || ''),
      categories: normalizeList(entry.categories),
      tags: normalizeList(entry.tags),
      keywords: normalizeList(entry.keywords),
      series: String(entry.series || ''),
      summary: String(entry.summary || ''),
      content: String(entry.content || '')
    };

    prepared.search = {
      title: normalize(prepared.title),
      categories: prepared.categories.map(normalize),
      tags: prepared.tags.map(normalize),
      keywords: prepared.keywords.map(normalize),
      series: normalize(prepared.series),
      summary: normalize(prepared.summary),
      content: normalize(prepared.content)
    };
    prepared.search.all = [
      prepared.search.title,
      prepared.search.categories.join(' '),
      prepared.search.tags.join(' '),
      prepared.search.keywords.join(' '),
      prepared.search.series,
      prepared.search.summary,
      prepared.search.content
    ].join(' ');
    return prepared;
  }

  function loadEntries() {
    if (entriesPromise) return entriesPromise;

    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, indexTimeout);
    entriesPromise = fetch(dialog.dataset.searchPath, {
      cache: 'force-cache',
      signal: controller.signal
    })
      .then(function (response) {
        if (!response.ok) throw new Error('search index unavailable');
        return response.json();
      })
      .then(function (payload) {
        const entries = Array.isArray(payload) ? payload : payload && payload.entries;
        if (!Array.isArray(entries)) throw new Error('invalid search index');
        return entries.map(prepareEntry).filter(function (entry) { return entry.title && entry.url; });
      })
      .catch(function (error) {
        entriesPromise = null;
        throw error;
      })
      .finally(function () { window.clearTimeout(timeout); });

    return entriesPromise;
  }

  function listScore(values, token, exactScore, partialScore) {
    return values.reduce(function (score, value) {
      if (value === token) return Math.max(score, exactScore);
      if (value.includes(token)) return Math.max(score, partialScore);
      return score;
    }, 0);
  }

  function scoreEntry(entry, tokens, query) {
    if (!tokens.every(function (token) { return entry.search.all.includes(token); })) return 0;

    let score = 0;
    if (entry.search.title === query) score += 240;
    else if (entry.search.title.startsWith(query)) score += 150;
    else if (entry.search.title.includes(query)) score += 100;

    tokens.forEach(function (token) {
      if (entry.search.title.includes(token)) score += 72;
      if (entry.search.series.includes(token)) score += 58;
      score += listScore(entry.search.tags, token, 62, 44);
      score += listScore(entry.search.categories, token, 56, 38);
      score += listScore(entry.search.keywords, token, 50, 34);
      if (entry.search.summary.includes(token)) score += 20;
      if (entry.search.content.includes(token)) score += 8;
    });
    return score;
  }

  function excerptFor(entry, tokens) {
    const source = entry.content || entry.summary;
    if (!source) return '';
    const normalizedSource = normalize(source);
    const indexes = tokens.map(function (token) { return normalizedSource.indexOf(token); }).filter(function (index) { return index >= 0; });
    const matchIndex = indexes.length ? Math.min.apply(Math, indexes) : 0;
    const start = Math.max(0, matchIndex - 34);
    const characters = Array.from(source);
    const excerpt = characters.slice(start, start + 128).join('');
    return `${start ? '…' : ''}${excerpt}${characters.length > start + 128 ? '…' : ''}`;
  }

  function resultMeta(entry, tokens) {
    const values = [];
    if (entry.date) values.push(entry.date.slice(0, 10).replace(/-/g, '.'));
    if (entry.series) values.push(entry.series);
    else if (entry.categories.length) values.push(entry.categories[0]);
    const matchingTags = entry.tags.filter(function (tag) {
      const normalizedTag = normalize(tag);
      return tokens.some(function (token) { return normalizedTag.includes(token); });
    });
    const otherTags = entry.tags.filter(function (tag) { return !matchingTags.includes(tag); });
    matchingTags.concat(otherTags).slice(0, 2).forEach(function (tag) { values.push(`#${tag}`); });
    return values.join(' / ');
  }

  function render(items, tokens, query) {
    results.replaceChildren();
    retryButton.hidden = true;
    if (!query) {
      status.textContent = '输入关键词开始搜索';
      return;
    }

    status.textContent = items.length ? `${items.length} 条匹配结果` : '没有找到匹配文章';
    items.slice(0, 10).forEach(function (item) {
      const link = document.createElement('a');
      const meta = document.createElement('span');
      const title = document.createElement('strong');
      const excerpt = document.createElement('span');
      link.href = item.url;
      meta.className = 'search-result__meta';
      title.className = 'search-result__title';
      excerpt.className = 'search-result__excerpt';
      meta.textContent = resultMeta(item, tokens);
      title.textContent = item.title;
      excerpt.textContent = excerptFor(item, tokens);
      link.append(meta, title, excerpt);
      results.appendChild(link);
    });
  }

  function showLoadError(revision) {
    if (revision !== searchRevision) return;
    results.replaceChildren();
    status.textContent = '搜索索引加载失败';
    retryButton.hidden = false;
  }

  async function performSearch(query, revision) {
    const normalizedQuery = normalize(query);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (!tokens.length) return render([], [], '');

    status.textContent = '正在搜索…';
    retryButton.hidden = true;
    try {
      const entries = await loadEntries();
      if (revision !== searchRevision) return;
      const matches = entries
        .map(function (entry) { return { entry, score: scoreEntry(entry, tokens, normalizedQuery) }; })
        .filter(function (item) { return item.score > 0; })
        .sort(function (left, right) {
          if (right.score !== left.score) return right.score - left.score;
          return String(right.entry.date).localeCompare(String(left.entry.date));
        })
        .map(function (item) { return item.entry; });
      render(matches, tokens, query);
    } catch (_) {
      showLoadError(revision);
    }
  }

  function scheduleSearch() {
    window.clearTimeout(debounceTimer);
    searchRevision += 1;
    const revision = searchRevision;
    const query = input.value.trim();
    if (!query) return render([], [], '');
    status.textContent = '正在搜索…';
    debounceTimer = window.setTimeout(function () { performSearch(query, revision); }, 140);
  }

  function preload() {
    if (entriesPromise) return;
    status.textContent = '正在准备搜索索引…';
    retryButton.hidden = true;
    const revision = searchRevision;
    loadEntries()
      .then(function () {
        if (revision === searchRevision && !input.value.trim()) status.textContent = '输入关键词开始搜索';
      })
      .catch(function () {
        if (!input.value.trim()) showLoadError(revision);
      });
  }

  function open() {
    dialog.showModal();
    preload();
    window.setTimeout(function () { input.focus(); }, 20);
  }

  function close() {
    window.clearTimeout(debounceTimer);
    searchRevision += 1;
    dialog.close();
  }

  openButtons.forEach(function (button) { button.addEventListener('click', open); });
  closeButton.addEventListener('click', close);
  retryButton.addEventListener('click', function () {
    entriesPromise = null;
    if (input.value.trim()) scheduleSearch();
    else preload();
  });
  input.addEventListener('input', scheduleSearch);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) close(); });
  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dialog.open ? close() : open();
    }
  });
})();
