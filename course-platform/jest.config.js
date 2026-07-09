module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Each handler under src/handlers ships its own node_modules (for esbuild bundling
  // at synth time), which would otherwise shadow the root copy and make jest.mock()
  // in the test miss the module instance the handler actually requires. Force every
  // @aws-sdk/* import back to the single root-installed copy so mocks always apply.
  moduleNameMapper: {
    '^@aws-sdk/(.*)$': '<rootDir>/node_modules/@aws-sdk/$1',
  },
  // Handler entry points under src/handlers are plain ESM JS (see create-handler.ts);
  // ts-jest transpiles them to CommonJS too so jest.mock() can intercept their
  // AWS SDK imports the same way it does for the .test.ts files that import them.
  transform: {
    '^.+\\.(ts|js)$': ['ts-jest', {
      tsconfig: {
        allowJs: true,
        module: 'commonjs',
        target: 'es2022',
        esModuleInterop: true,
      },
    }],
  },
};
