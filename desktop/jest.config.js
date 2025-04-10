/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

module.exports = {
  transform: {
    '^.*__tests__(/|\\\\).*\\.tsx?$': 'ts-jest',
    '\\.(js|tsx?)$': '<rootDir>/scripts/jest-transform.js',
  },
  setupFiles: ['<rootDir>/scripts/jest-setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/scripts/jest-setup-after.ts'],
  moduleNameMapper: {
    '^flipper$': '<rootDir>/app/src',
    '^flipper-plugin$': '<rootDir>/flipper-plugin/src',
    '^flipper-(server-core|ui-core|common)$': '<rootDir>/flipper-$1/src',
    '^flipper-(pkg|pkg-lib|doctor|test-utils)$': '<rootDir>/$1/src',
  },
  clearMocks: true,
  coverageReporters: ['json-summary', 'lcov', 'html'],
  testMatch: ['**/**.(node|spec).(js|jsx|ts|tsx)'],
  testEnvironment: 'jest-environment-jsdom-sixteen',
  resolver: '<rootDir>/jest.resolver.js',
};
