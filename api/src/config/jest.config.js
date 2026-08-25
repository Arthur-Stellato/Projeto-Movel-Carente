module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  clearMocks: false, // controlamos o reset manualmente em jest.setup.js (afterEach)
  verbose: true,
};