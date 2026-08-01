const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

// Parses simple durations like "15m", "7d", "10s" into milliseconds.
function parseDurationMs(input) {
  const match = /^(\d+)(s|m|h|d)$/.exec(String(input).trim());
  if (!match) {
    throw new Error(`Invalid duration string: ${input}`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}

function addDuration(date, durationStr) {
  return new Date(date.getTime() + parseDurationMs(durationStr));
}

module.exports = { parseDurationMs, addDuration };
