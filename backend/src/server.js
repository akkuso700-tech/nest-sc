// Hostinger starts this configured entry file directly. Keep it as the
// process supervisor so both the HTTP API and the independent Loop worker
// are present regardless of whether the platform runs `npm start` or `main`.
require('./startAll')
