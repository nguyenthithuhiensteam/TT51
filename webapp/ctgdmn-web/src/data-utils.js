export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterDocuments(documents, filters = {}) {
  const query = normalizeText(filters.query || '');
  return documents.filter((document) => {
    if (filters.ageGroup && filters.ageGroup !== 'all' && document.ageGroup !== filters.ageGroup) return false;
    if (filters.documentType && filters.documentType !== 'all' && document.documentType !== filters.documentType) return false;
    if (filters.collection && filters.collection !== 'all' && document.collection !== filters.collection) return false;
    if (query && !normalizeText(`${document.title} ${document.collection} ${document.searchText}`).includes(query)) return false;
    return true;
  });
}

export function paginate(items, page = 1, pageSize = 12) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: safePage, totalPages };
}

export function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = typeof key === 'function' ? key(item) : item[key];
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

export function reviewSummary(documents, reviewState) {
  const reviewed = new Set(reviewState.reviewed || []);
  const watch = new Set(reviewState.watch || []);
  return {
    reviewed: documents.filter((item) => reviewed.has(item.id)).length,
    watch: documents.filter((item) => watch.has(item.id)).length,
    total: documents.length,
    percent: documents.length ? Math.round((reviewed.size / documents.length) * 100) : 0,
  };
}

export function safeFilename(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'ctgdmn';
}
