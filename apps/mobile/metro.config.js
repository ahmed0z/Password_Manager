const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo (workspace packages)
config.watchFolders = [monorepoRoot];

// Ensure Metro resolves node_modules from both the project and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Block Metro from watching Next.js build directories and extension dist folders to prevent ENOENT crashes
config.resolver.blockList = [
  /[\\/]apps[\\/]web[\\/]\.next/,
  /[\\/]apps[\\/]web[\\/]out/,
  /[\\/]apps[\\/]extension[\\/]dist/,
  /[\\/]\.turbo/,
];

module.exports = config;
