import type { CallOptions, Transport } from "@connectrpc/connect";
import type { FileRegistry } from "@bufbuild/protobuf";

import { DynamicDispatchClient } from "./dynamic_dispatch_client.js";

/**
 * Dynamic service proxy type.
 * Allows calling methods by name with automatic method kind detection.
 */
export type DynamicServiceProxy = {
  [methodName: string]: (
    requestOrRequests: unknown | AsyncIterable<unknown>,
    options?: CallOptions,
  ) => Promise<unknown> | AsyncIterable<unknown>;
};

/**
 * Proxy-based gRPC client for a specific service.
 * Methods are accessed as properties using localName (lowerCamelCase).
 *
 * This client provides a more ergonomic API compared to DynamicDispatchClient
 * by allowing method invocation through property access.
 *
 * @example
 * ```typescript
 * // Build a FileRegistry from reflection or static descriptors
 * const reflection = new ServerReflectionClient(transport);
 * const registry = await reflection.buildFileRegistry();
 *
 * // Create the proxy dispatch client for a specific service
 * const echo = new ProxyDispatchClient(transport, registry, "echo.EchoService");
 *
 * // Methods are accessed via localName (lowerCamelCase)
 * const response = await echo.say({ sentence: "Hello" });
 *
 * // Server streaming
 * for await (const msg of echo.sayServerStream({ sentence: "Hello" })) {
 *   console.log(msg);
 * }
 *
 * // Bidirectional streaming
 * async function* requests() {
 *   yield { sentence: "Hello" };
 *   yield { sentence: "World" };
 * }
 * for await (const msg of echo.sayBidi(requests())) {
 *   console.log(msg);
 * }
 *
 * // With cancellation
 * const controller = new AbortController();
 * const response = await echo.say({ sentence: "Hello" }, { signal: controller.signal });
 * ```
 */
export class ProxyDispatchClient {
  /**
   * Creates a new ProxyDispatchClient.
   *
   * The constructor returns a Proxy that intercepts property access
   * and routes method calls to the underlying DynamicDispatchClient.
   *
   * @param transport - The ConnectRPC transport to use for communication
   * @param registry - The FileRegistry containing service and message descriptors
   * @param serviceName - Fully-qualified service name (e.g., "echo.EchoService")
   * @returns A proxy object that allows calling methods by name
   */
  constructor(
    transport: Transport,
    registry: FileRegistry,
    serviceName: string,
  ) {
    const client = new DynamicDispatchClient(transport, registry);

    return new Proxy(this, {
      get(_target, methodName: string) {
        // Return a function that invokes the method
        return (
          requestOrRequests: unknown | AsyncIterable<unknown>,
          options?: CallOptions,
        ) => {
          // Detect if input is an async iterable (for streaming methods)
          const isAsyncIterable =
            requestOrRequests != null &&
            typeof requestOrRequests === "object" &&
            Symbol.asyncIterator in requestOrRequests;

          if (isAsyncIterable) {
            // For streaming input, use bidiStream
            // Note: This assumes bidi or client streaming based on input type
            // The actual method kind is determined by the server
            return client.bidiStream(
              serviceName,
              methodName,
              requestOrRequests as AsyncIterable<unknown>,
              options,
            );
          } else {
            // For single input, use call (handles unary and server streaming)
            return client.call(
              serviceName,
              methodName,
              requestOrRequests,
              options,
            );
          }
        };
      },
    }) as ProxyDispatchClient;
  }

  // Index signature for type safety
  [methodName: string]: (
    requestOrRequests: unknown | AsyncIterable<unknown>,
    options?: CallOptions,
  ) => Promise<unknown> | AsyncIterable<unknown>;
}
