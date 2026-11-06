(() => {
  const form = document.querySelector('#terminal-search-form');
  if (!form) return;
  const query = form.querySelector('input');
  const results = document.querySelector('#search-results');
  const status = document.querySelector('#search-status');
  let indexPromise;
  let requestNumber = 0;
  const normalize = value => value.toLocaleLowerCase();
  async function run() {
    const request = ++requestNumber;
    const terms = normalize(query.value.trim()).split(/\s+/).filter(Boolean);
    results.replaceChildren();
    document.querySelector(".search-idle").hidden = terms.length > 0;
    if (!terms.length) { status.textContent = 'Start typing to search across Blog, Notes, and Writeups.'; return; }
    status.textContent = 'Searching…';
    try {
      if (!indexPromise) indexPromise = fetch(results.dataset.index).then(response => {
        if (!response.ok) throw new Error('Index unavailable');
        return response.json();
      }).catch(error => { indexPromise = undefined; throw error; });
      const index = await indexPromise;
      if (request !== requestNumber) return;
      const matches = index.map(item => ({ item, title: normalize(item.title), text: normalize(`${item.title} ${item.description || ''} ${item.content || ''} ${item.keywords || ''}`) }))
        .filter(row => terms.every(term => row.text.includes(term)))
        .sort((a,b) => Number(terms.every(t => b.title.includes(t))) - Number(terms.every(t => a.title.includes(t))) || a.item.title.localeCompare(b.item.title));
      status.textContent = matches.length ? `${matches.length} result${matches.length === 1 ? '' : 's'} found` : 'No results found. Try another topic, tool, or keyword.';
      for (const { item } of matches) {
        const article = document.createElement('article'); article.className = 'terminal-search-result';
        const heading = document.createElement('h2'); heading.textContent = `Title: ${item.title}`;
        const description = document.createElement('p'); description.textContent = item.description || '';
        const meta = document.createElement('div'); meta.className = 'terminal-search-meta';
        const badge = document.createElement('span'); badge.className = `search-section search-section-${item.section}`; badge.textContent = item.section;
        const date = document.createElement('span'); date.textContent = item.date.toUpperCase();
        const time = document.createElement('span'); time.textContent = `${item.readingTime} MIN READ`;
        meta.append(badge,date,time);
        const command = document.createElement('div'); command.className = 'terminal-search-open';
        const prompt = document.createElement('span'); prompt.textContent = 'visitor@shellthisbox:~$';
        const link = document.createElement('a'); link.href = item.permalink; link.textContent = `cat ~${item.permalink.replace(/\/$/, '')}.md`;
        command.append(prompt,link); article.append(heading,description,meta,command); results.append(article);
      }
    } catch {
      if (request === requestNumber) status.textContent = 'Search is temporarily unavailable. Please try again or browse Notes and Writeups.';
    }
  }
  form.addEventListener('submit', e => { e.preventDefault(); run(); });
  query.addEventListener('input', run);
})();
