module.exports = {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json'],
    testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
    coveragePathIgnorePatterns: ['/node_modules/'],
    setupFiles: ['./jest.setup.js'],
    testPathIgnorePatterns: ['/node_modules/'],
    collectCoverage: true,
    coverageReporters: ['text', 'lcov'],
    coverageDirectory: 'coverage'
};
