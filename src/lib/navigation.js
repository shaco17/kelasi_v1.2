/** Return only complete navigation entries; stale/malformed entries must not crash rendering. */
export function selectNavigationItems(items, ids) {
  const source = Array.isArray(items) ? items : [];
  const valid = item => item && typeof item.id === 'string' && item.id && item.icon;
  if (!Array.isArray(ids)) return source.filter(valid);

  return [...new Set(ids)]
    .map(id => source.find(item => valid(item) && item.id === id))
    .filter(Boolean);
}

/** Resolve an obsolete or unknown page key to the home page. */
export function resolvePage(page, items) {
  const validIds = new Set(selectNavigationItems(items).map(item => item.id));
  return validIds.has(page) ? page : 'home';
}
