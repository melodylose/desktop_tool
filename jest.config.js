module.exports = {
    reporters: [
        'default',
        ['jest-html-reporter', {
            pageTitle: 'Test Report',
            outputPath: './test-report.html',
        }]
    ],
    setupFilesAfterEnv: [
        '<rootDir>/jest.setup.js',
        '<rootDir>/src/__tests__/setup.js'
    ],
    testEnvironment: 'node',
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    verbose: true,
    testMatch: [
        '**/__tests__/**/*.test.js'
    ],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    transformIgnorePatterns: [
        '/node_modules/',
        '\\.pnp\\.[^\\/]+$'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
    ],
    moduleFileExtensions: ['js', 'json', 'jsx', 'node'],
    testEnvironmentOptions: {
        url: 'http://localhost'
    },
    globals: {
        'window': {},
        'document': {}
    }
};
