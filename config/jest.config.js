module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg)$': '<rootDir>/__mocks__/fileMock.js',
    'electron-store': '<rootDir>/__mocks__/electron-store.js',
    'electron': '<rootDir>/__mocks__/electron/index.js',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx}',
    '<rootDir>/__tests__/**/*.{js,jsx}'
  ],
  moduleFileExtensions: ['js', 'jsx'],
  verbose: true,
  transformIgnorePatterns: [
    '/node_modules/(?!(electron-store|chai|sinon)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/index.{js,jsx}',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 60,
      functions: 60,
      lines: 60
    },
    'src/main/services/WindowManager.js': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    },
    'src/main/services/MemoryManager.js': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    },
    'src/main/ipc/**/*.js': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    },
    'src/main/services/ServiceRegistry.js': {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    }
  },
  moduleDirectories: ['node_modules', '__tests__/helpers']
}; 