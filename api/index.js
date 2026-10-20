const { createHandler } = require('../server');

// Reuse the handler within a warm instance; Vercel manages the HTTP listener.
module.exports = createHandler();
