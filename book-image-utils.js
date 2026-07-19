(function(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.bookImageUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  function normalizeBookImageKey(value){
    return String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  }

  function getBookImageCandidates(book){
    const candidates = [];
    if (book && book.id !== undefined && book.id !== null && book.id !== '') {
      candidates.push(String(book.id));
    }
    if (book && book.ean) {
      candidates.push(normalizeBookImageKey(book.ean));
    }
    return candidates;
  }

  function resolveBookImage(cache, book){
    if (!cache || !book) return null;
    for (const key of getBookImageCandidates(book)) {
      if (cache[key]) return cache[key];
    }
    return null;
  }

  function buildBookImageEntries(book, img){
    const entries = {};
    if (!book || !img) return entries;
    if (book.id !== undefined && book.id !== null && book.id !== '') {
      entries[String(book.id)] = img;
    }
    if (book.ean) {
      entries[normalizeBookImageKey(book.ean)] = img;
    }
    return entries;
  }

  function applyBookImagesToBooks(books, cache){
    if (!Array.isArray(books)) return;
    books.forEach(book => {
      const img = resolveBookImage(cache, book);
      if (img) book.img = img;
    });
  }

  return {
    normalizeBookImageKey,
    getBookImageCandidates,
    resolveBookImage,
    buildBookImageEntries,
    applyBookImagesToBooks
  };
});
