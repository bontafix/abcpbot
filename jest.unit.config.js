const base = require('./jest.config.js');

module.exports = {
  ...base,
  testPathIgnorePatterns: [
    ...(base.testPathIgnorePatterns || []),
    '<rootDir>/src/__tests__/invoice/integration.test.ts'
  ]
};


