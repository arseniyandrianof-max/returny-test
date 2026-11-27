const control = '310633997';
const countries = new Set(['ru', 'es']);
const validId = /^[1-9]\d{0,17}$/;

// Apple's public software lookup also returns games for Mac and iPad.
export async function checkApple({country, term, ids, signal}, request = fetch) {
  if (!countries.has(country) || (ids === undefined) === (term === undefined)) {
    throw new TypeError('Invalid Apple catalog query');
  }
  const url = new URL(ids ? 'https://itunes.apple.com/lookup' : 'https://itunes.apple.com/search');
  url.searchParams.set('country', country);
  let requested;
  if (ids !== undefined) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 40 ||
        !ids.every(id => typeof id === 'string' && validId.test(id))) throw new TypeError('Invalid IDs');
    requested = new Set(ids);
    url.searchParams.set('id', [...new Set([...ids, control])].join(','));
  } else {
    if (typeof term !== 'string' || !term.trim() || term.length > 200) throw new TypeError('Invalid search');
    url.searchParams.set('term', term.trim());
    url.searchParams.set('entity', 'software');
    url.searchParams.set('limit', '12');
  }
  const response = await request(url, {credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal});
  if (!response.ok) throw new Error('Apple catalog unavailable');
  const payload = await response.json();
  if (!Array.isArray(payload?.results) || payload.resultCount !== payload.results.length) {
    throw new Error('Invalid Apple catalog response');
  }
  let controlPresent = false;
  const found = new Map();
  for (const row of payload.results) {
    if (row?.kind !== 'software' || row.wrapperType !== 'software' ||
        !Array.isArray(row.supportedDevices) || !row.supportedDevices.some(device => /^iPhone/i.test(device))) continue;
    const id = String(row.trackId);
    if (!Number.isSafeInteger(row.trackId) || !validId.test(id) || typeof row.trackName !== 'string' || !row.trackName.trim()) continue;
    const listing = new URL(row.trackViewUrl);
    if (listing.origin !== 'https://apps.apple.com' || !listing.pathname.startsWith('/' + country + '/')) {
      throw new Error('Unexpected Apple storefront');
    }
    if (id === control && row.bundleId === 'net.whatsapp.WhatsApp') controlPresent = true;
    if (!requested || requested.has(id)) {
      found.set(id, {id, title: row.trackName.trim(), url: 'https://apps.apple.com/' + country + '/app/id' + id});
    }
  }
  if (requested && !controlPresent) throw new Error('Incomplete Apple lookup');
  return requested ? [...requested].filter(id => found.has(id)).map(id => found.get(id)) : [...found.values()];
}
