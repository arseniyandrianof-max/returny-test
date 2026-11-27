const productLink = /^https:\/\/(?:apps|itunes)\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:(?<slug>[^/?#\s]+)\/)?id(?<id>[1-9]\d{0,17})\/?(?:\?[^#\s]*)?(?:#[^\s]*)?$/i;
const looksLikeLink = /^(?:[a-z][a-z\d+.-]*:|\/|www\.|(?:apps|itunes)\.apple\.com\b|(?:[a-z\d-]+\.)+[a-z]{2,}[/?#])/i;
const publisherLinks = new Map([
  ["fortnite", {
    url: "https://www.fortnite.com/mobile/ios?lang=ru",
    regions: ["es"],
    ids: ["6483539426"],
  }],
]);

function idFromAppleUrl(value) {
  const match = productLink.exec(value);
  if (!match || value.includes("\\")) return null;
  if (match.groups.slug) {
    try {
      const slug = decodeURIComponent(match.groups.slug);
      if (slug === "." || slug === ".." || /[/\\?#\x00-\x1f\x7f]/.test(slug)) return null;
    } catch {
      return null;
    }
  }
  return match.groups.id;
}

function normalizeName(text = "") {
  return text.normalize("NFKC").toLowerCase().replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function listedReleases(group, releases, country, catalog) {
  const available = [];
  const snapshot = catalog.regions[country];
  for (const release of releases) {
    const title = snapshot[release.id];
    if (typeof title === "string" && title.length) {
      available.push({ id: release.id, title, url: appleUrl(release.id, country) });
    }
  }
  const result = { kind: "app", group, releases, available };
  const trusted = publisherLinks.get(group.key);
  const publisher = group.publisher;
  if (trusted && publisher?.url === trusted.url && trusted.regions.includes(country) &&
      publisher.regions.includes(country) && releases.some(release => trusted.ids.includes(release.id))) {
    result.publisher = { label: publisher.label, url: trusted.url, condition: publisher.condition };
  }
  return result;
}

function appleUrl(id, country) {
  return `https://apps.apple.com/${country}/app/id${id}`;
}

export function resolveInput(query, country, catalog) {
  if (typeof query !== "string" || typeof country !== "string" || !/^[a-z]{2}$/.test(country) ||
      !Object.hasOwn(catalog.regions, country)) return { kind: "invalid" };
  if (query.length > 2048) return { kind: "invalid" };
  const value = query.trim();
  if (!value) return { kind: "empty" };
  if (/[\x00-\x1f\x7f]/.test(query)) return { kind: "invalid" };
  const searchUrl = new URL(`https://apps.apple.com/${country}/iphone/search`);
  searchUrl.searchParams.set("term", value);
  const search = {url: searchUrl.href};

  let id = /^(?:id)?([1-9]\d{0,17})$/i.exec(value)?.[1];
  if (looksLikeLink.test(value)) {
    id = idFromAppleUrl(value);
    if (!id) return { kind: "invalid" };
  }
  if (id) {
    for (const group of catalog.groups) {
      const release = group.releases.find(entry => entry.id === id);
      if (release) return listedReleases(group, [release], country, catalog);
    }
    return { kind: "app", releases: [], available: [], direct: { id, url: appleUrl(id, country) },
      search: value === id ? search : undefined };
  }
  if (value.length > 200 || /^(?:id\s*\d|\d+$)/i.test(value)) return { kind: "invalid" };

  const name = normalizeName(value);
  if (name) {
    const exact = catalog.groups.find(group => [group.key, group.title, group.aliases].some(text => normalizeName(text) === name));
    if (exact) return listedReleases(exact, exact.releases, country, catalog);
    for (const group of catalog.groups) {
      const exactReleases = group.releases.filter(release =>
        [release.title, release.aliases].some(text => normalizeName(text) === name));
      if (exactReleases.length) return listedReleases(group, exactReleases, country, catalog);
    }
    const matches = [];
    for (const group of catalog.groups) {
      const containsName = text => normalizeName(text).includes(name);
      const releases = [group.title, group.key, group.aliases].some(containsName) ? group.releases :
        group.releases.filter(release => [release.title, release.aliases].some(containsName));
      if (releases.length) matches.push({ group, releases });
    }
    if (matches.length) return { kind: "matches", groups: matches.map(match => match.group), search };
  }
  return { kind: "query", search };
}
