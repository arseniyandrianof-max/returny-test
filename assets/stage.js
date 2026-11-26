'use strict';
const search = document.getElementById('search');
if (search) {
  const rows = Array.from(document.querySelectorAll('[data-search]'));
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase().replace(/ё/g, 'е');
    const matches = rows.filter(row => row.dataset.search.includes(query));
    for (const row of rows) {
      row.hidden = !matches.includes(row);
      row.open = !!query && matches.length === 1 && !row.hidden;
    }
    document.getElementById('empty').hidden = matches.length > 0;
  });
}

const handoff = document.getElementById('handoff');
if (handoff) {
  const field = document.getElementById('share-link');
  field.value = new URL('download.html', location.href).href;
  handoff.hidden = false;
  document.getElementById('copy').addEventListener('click', async () => {
    const status = document.getElementById('copied');
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = 'Ссылка скопирована.';
    } catch {
      field.focus();
      field.select();
      status.textContent = 'Скопируйте выделенную ссылку.';
    }
  });
}
