document.querySelectorAll('.post .highlight').forEach(box => { const pre = box.querySelector('pre'); if (!pre) return; const button = document.createElement('button'); button.className='copy'; button.type='button'; button.textContent='COPY'; button.setAttribute('aria-label','Copy code'); button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.innerText); button.textContent='COPIED'; setTimeout(() => button.textContent='COPY', 1800); } catch { button.textContent='UNAVAILABLE'; } }); box.appendChild(button); });
const searchForm = document.querySelector('#site-search');
if (searchForm) {
 const query = document.querySelector('#search-query'); const results = document.querySelector('#search-results'); const status = document.querySelector('#search-status'); let index; let requestNumber = 0;
 const run = async () => {
  const currentRequest = ++requestNumber; const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean); results.replaceChildren();
  if (!terms.length) { status.textContent='Start typing to search.'; return; }
  try { if (!index) { const response = await fetch(results.dataset.index); if (!response.ok) throw new Error('index unavailable'); index = await response.json(); }
   if (currentRequest !== requestNumber) return;
   const matches = index.filter(item => terms.every(term => `${item.title} ${item.description || ''} ${item.content}`.toLocaleLowerCase().includes(term)));
   status.textContent = matches.length ? `${matches.length} result${matches.length === 1 ? '' : 's'}` : 'No results found. Try another search.';
   matches.forEach(item => { const article = document.createElement('article'); article.className='search-result'; const meta=document.createElement('div'); meta.className='tag'; meta.textContent=item.date; const heading=document.createElement('h2'); const link=document.createElement('a'); link.href=item.permalink; link.textContent=item.title + ' ↗'; heading.append(link); const description=document.createElement('p'); description.textContent=item.description || ''; article.append(meta,heading,description); results.append(article); });
  } catch { if (currentRequest !== requestNumber) return; status.textContent='Search is unavailable. Please browse the archive instead.'; }
 }; searchForm.addEventListener('submit',event=>{event.preventDefault();run()}); query.addEventListener('input',run);
}
