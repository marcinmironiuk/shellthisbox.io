(() => {
  const root = document.querySelector('.notes-list');
  if (!root) return;
  const form = root.querySelector('form');
  const input = form.querySelector('input');
  const filters = [...form.querySelectorAll('.notes-filters select')];
  const sort = form.elements.sort;
  const results = root.querySelector('.notes-results');
  const entries = [...results.children].map((el, index) => ({ el, index,
    title: el.dataset.title, date: el.dataset.date, series: el.dataset.series,
    order: Number(el.dataset.order), note_type: el.dataset.note_type,
    note_area: el.dataset.note_area, note_platform: el.dataset.note_platform,
    note_topics: JSON.parse(el.dataset.note_topics || 'null') || [],
    search: el.textContent.toLocaleLowerCase()
  }));
  for (const filter of filters) {
    const values = filter.name === "note_type" ? ["guide", "methodology", "technique", "cheat sheet", "checklist"] : filter.name === "note_area" ? ["Pre-engagement", "Reconnaissance", "Enumeration", "Threat modeling", "Vulnerability analysis", "Exploitation", "Privilege escalation", "Lateral movement", "Post-exploitation", "Cleanup", "Reporting"] : filter.name === "note_platform" ? ["Linux", "Windows"] : [...new Set(entries.flatMap(e => e[filter.name]).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = filter.name === "note_type" ? value.charAt(0).toUpperCase() + value.slice(1) : value; filter.append(option); }
  }
  function render() {
    const query = input.value.trim().toLocaleLowerCase();
    const ordered = [...entries].sort((a,b) => {
      if (sort.value === 'newest') return b.date.localeCompare(a.date) || a.order-b.order;
      if (sort.value === 'oldest') return a.date.localeCompare(b.date) || a.order-b.order;
      if (sort.value === 'title') return a.title.localeCompare(b.title);
      return a.series.localeCompare(b.series) || a.order-b.order || a.index-b.index;
    });
    let visible = 0;
    for (const entry of ordered) {
      const match = (!query || entry.search.includes(query)) && filters.every(f => !f.value || (Array.isArray(entry[f.name]) ? entry[f.name].includes(f.value) : (entry[f.name] === f.value || (f.name === "note_platform" && entry.note_platform === "Cross-platform"))));
      entry.el.hidden = !match; if (match) visible++; results.append(entry.el);
    }
    root.querySelector('#notes-count').textContent = `FILTER CONSOLE: ${visible} of ${entries.length} notes`;
    root.querySelector('.notes-empty').hidden = visible !== 0;
  }
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('reset', () => setTimeout(render, 0));
  render(); form.hidden = false;
})();
