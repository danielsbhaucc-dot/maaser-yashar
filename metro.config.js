const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs", "cjs"];
// platform-core kits (core-sync, packages/@core) — bare "@core/<kit>" imports between kits.
const path = require("path");
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@core/crypto": path.resolve(__dirname, "packages/@core/crypto"),
  "@core/audit": path.resolve(__dirname, "packages/@core/audit"),
};
module.exports = config;
