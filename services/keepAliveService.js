const env = require('../config/env');

// Free hosting tiers (Render, Koyeb, Cyclic…) put an instance to sleep after a
// stretch with no inbound traffic, and the next visitor then pays a ~30–60s
// cold start. This pings our own public /health URL on an interval so the
// instance keeps receiving traffic and stays warm.
//
// Note: this only prevents the instance from *falling* asleep — once it is
// asleep the process is gone and nothing can ping from inside. Pair it with an
// external monitor (UptimeRobot / cron-job.org / a GitHub Action) hitting the
// same URL if the host suspends aggressively.
//
// Disabled unless KEEP_ALIVE_URL is set, so local/dev runs never self-ping.
function startKeepAlive() {
  const url = env.KEEP_ALIVE_URL;

  if (!url) return null;

  const intervalMs = env.KEEP_ALIVE_INTERVAL_MINUTES * 60 * 1000;

  const timer = setInterval(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`[keep-alive] ${url} responded ${res.status}`);
      }
    } catch (err) {
      console.warn(`[keep-alive] ping failed: ${err.message}`);
    }
  }, intervalMs);

  // Never hold the process open just for the pinger.
  if (typeof timer.unref === 'function') timer.unref();

  console.log(`[keep-alive] pinging ${url} every ${env.KEEP_ALIVE_INTERVAL_MINUTES}m`);
  return timer;
}

module.exports = { startKeepAlive };
