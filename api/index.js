// Vercel serverless entry point.
//
// vercel.json rewrites every incoming path to this file, so the Express app
// below sees the original URL and does all its own routing exactly as it does
// when running as a normal server. Nothing here may call app.listen(): Vercel
// invokes the exported handler directly.
module.exports = require('../index.js');
