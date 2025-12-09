// Re-export main client class with auto-fallback
export { ServerReflectionClient } from "./server_reflection_client.js";

// Re-export cached client and interface
export {
  CachedServerReflectionClient,
  type IServerReflectionClient,
} from "./cached.js";

// Re-export dynamic dispatch clients
export { DynamicDispatchClient } from "./dynamic_dispatch_client.js";
export {
  ProxyDispatchClient,
  type DynamicServiceProxy,
} from "./proxy_dispatch_client.js";

// Re-export types
export type {
  ServiceDescriptor,
  MethodDescriptor,
  CacheStats,
} from "./types.js";
export { ReflectionError } from "./types.js";

// Re-export CallOptions from @connectrpc/connect for convenience
export type { CallOptions } from "@connectrpc/connect";

// Re-export utilities
export {
  formatServiceList,
  formatServiceDescriptor,
  formatMethodDescriptor,
} from "./utils.js";

// Re-export protocol versions
export * as v1 from "./v1.js";
export * as v1alpha from "./v1alpha.js";
