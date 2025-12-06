import type { MethodInvoker } from "./invoker.js";

/**
 * Dynamic service proxy type.
 * Allows calling methods by name with automatic method kind detection.
 */
export type DynamicServiceProxy = {
  [methodName: string]: (
    requestOrRequests: unknown | AsyncIterable<unknown>,
  ) => Promise<unknown> | AsyncIterable<unknown>;
};

/**
 * Creates a Proxy-based service client that allows method calls via property access.
 *
 * @param invoker - The MethodInvoker to use for method calls
 * @param serviceName - The fully-qualified service name
 * @returns A proxy object that allows calling methods by name
 *
 * @example
 * ```typescript
 * const proxy = createServiceProxy(invoker, "grpc.echo.EchoService");
 *
 * // Call unary method
 * const response = await proxy.say({ sentence: "Hello" });
 *
 * // Call server streaming method
 * for await (const msg of proxy.sayServerStream({ sentence: "Hello" })) {
 *   console.log(msg);
 * }
 *
 * // Call bidi streaming method
 * async function* requests() {
 *   yield { sentence: "Hello" };
 * }
 * for await (const msg of proxy.sayBidi(requests())) {
 *   console.log(msg);
 * }
 * ```
 */
export function createServiceProxy(
  invoker: MethodInvoker,
  serviceName: string,
): DynamicServiceProxy {
  return new Proxy({} as DynamicServiceProxy, {
    get(_target, methodName: string) {
      // Return a function that invokes the method
      return (requestOrRequests: unknown | AsyncIterable<unknown>) => {
        const path = `${serviceName}/${methodName}`;

        // Detect if input is an async iterable (for streaming methods)
        const isAsyncIterable =
          requestOrRequests != null &&
          typeof requestOrRequests === "object" &&
          Symbol.asyncIterator in requestOrRequests;

        if (isAsyncIterable) {
          // For streaming input, use bidiStream
          // Note: This assumes bidi or client streaming based on input type
          // The actual method kind is determined by the invoker
          return invoker.bidiStream(
            path,
            requestOrRequests as AsyncIterable<unknown>,
          );
        } else {
          // For single input, try call first (unary or server streaming)
          // The invoker will handle the actual method kind
          return invoker.call(path, requestOrRequests);
        }
      };
    },
  });
}
