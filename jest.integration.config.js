const base = require('./jest.config.js');

module.exports = {
  ...base,
  testMatch: ['**/__tests__/invoice/integration.test.ts']
};


