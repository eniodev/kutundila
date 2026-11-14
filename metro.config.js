const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundled test models.
config.resolver.assetExts.push('ply');

// three's CommonJS entry (picked via the "require" export condition) calls
// process.emitWarning, which doesn't exist in React Native and crashes at startup.
// Always resolve 'three' to the ES module build, so there's a single instance too.
const threeModule = path.resolve(__dirname, 'node_modules/three/build/three.module.js');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
