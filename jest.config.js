/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/api/server.ts',
    '!src/index.ts',
    '!src/cli.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 10000,
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@solana)/)'
  ],
  moduleNameMapper: {
    '^uuid$': 'uuid',
    '^@solana/web3.js$': '<rootDir>/tests/__mocks__/solana-web3.ts'
  }
};
