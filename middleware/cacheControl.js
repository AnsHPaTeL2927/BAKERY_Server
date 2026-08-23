// Public catalog reads are the same for every visitor and change only when an
// admin edits something, so they are served from Vercel's CDN rather than
// re-running the function and re-querying the database for each visitor.
//
// s-maxage governs the shared CDN cache; max-age=0 keeps browsers revalidating
// so a stale copy is never pinned in someone's browser where it cannot be
// purged. stale-while-revalidate lets the edge answer instantly from a slightly
// old copy while it refreshes in the background, so visitors never wait on a
// cold function.
//
// The window is deliberately short: an admin publishing a product should see it
// live within about a minute, which matters more here than shaving the last few
// database queries.
function cachePublic({ seconds = 60, staleWhileRevalidate = 600 } = {}) {
  return function cacheControlMiddleware(req, res, next) {
    // Only ever cache plain reads. Anything else must reach the function.
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${staleWhileRevalidate}`);
    }
    next();
  };
}

module.exports = { cachePublic };
