// Expo configures Metro for pnpm monorepos automatically (SDK 52+). Two additions:
//  1. @kiwanja/core and @kiwanja/client are TypeScript consumed from source and use
//     Node-style ".js" suffixes on relative imports: map those to the .ts files.
//  2. The shared client must use this app's single copy of React, React Query and
//     Socket.IO (the web app uses React 18, this app React 19).
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultResolve = config.resolver.resolveRequest;
const SINGLETONS = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@tanstack/react-query', 'socket.io-client'];
const appOrigin = path.join(__dirname, 'package.json');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolve ?? context.resolveRequest;
  if (SINGLETONS.includes(moduleName) && !context.originModulePath.startsWith(path.join(__dirname, 'node_modules'))) {
    return resolve({ ...context, originModulePath: appOrigin }, moduleName, platform);
  }
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform);
    } catch {
      // fall through to the default resolution
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
