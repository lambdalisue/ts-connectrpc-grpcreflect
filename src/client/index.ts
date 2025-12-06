import type { Transport } from "@connectrpc/connect";

import { ServerReflectionClient } from "./v1.js";

// Re-export main client class
export { ServerReflectionClient } from "./v1.js";

// Re-export cached client
export { CachedServerReflectionClient } from "./cached.js";

// Re-export types
export type {
  ServiceDescriptor,
  MethodDescriptor,
  CacheStats,
} from "./types.js";
export { ReflectionError } from "./types.js";

// Re-export utilities
export {
  formatServiceList,
  formatServiceDescriptor,
  formatMethodDescriptor,
} from "./utils.js";

// Re-export protocol versions
export * as v1 from "./v1.js";
export * as v1alpha from "./v1alpha.js";

/**
 * Creates a server reflection client with the given transport.
 *
 * @param transport - The ConnectRPC transport to use
 * @returns A new ServerReflectionClient instance
 *
 * @example
 * ```typescript
 * import { createServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";
 * import { createGrpcTransport } from "@connectrpc/connect-node";
 *
 * const transport = createGrpcTransport({
 *   baseUrl: "https://api.example.com",
 *   httpVersion: "2",
 * });
 *
 * const client = createServerReflectionClient(transport);
 * const services = await client.listServices();
 * ```
 */
export function createServerReflectionClient(
  transport: Transport,
): ServerReflectionClient {
  return new ServerReflectionClient(transport);
}
