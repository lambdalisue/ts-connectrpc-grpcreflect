// Re-export server API for backward compatibility
export {
  registerServerReflectionFromFileDescriptorSet,
  registerServerReflectionFromUint8Array,
  registerServerReflectionFromFile,
} from "./server/index.js";

// Namespace exports
export * as server from "./server/index.js";
export * as client from "./client/index.js";
export * as common from "./common/registry.js";
