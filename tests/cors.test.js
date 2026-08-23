const test = require('node:test');
const assert = require('node:assert/strict');

test('configured origins match however they were written into the env var', () => {
  const cases = [
    'https://cakebytulsi.com,https://www.cakebytulsi.com',
    'https://cakebytulsi.com/,https://www.cakebytulsi.com/',   // trailing slashes
    ' https://cakebytulsi.com , https://www.cakebytulsi.com ', // stray spaces
    'https://CakeByTulsi.com,https://WWW.CakeByTulsi.com',     // mixed case
  ];

  for (const value of cases) {
    process.env.FRONTEND_URL = value;
    delete require.cache[require.resolve('../config/env')];
    const env = require('../config/env');
    assert.deepEqual(env.FRONTEND_URLS, ['https://cakebytulsi.com', 'https://www.cakebytulsi.com'], `failed for: ${value}`);
  }
});
