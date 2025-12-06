import type { CallOptions } from "@connectrpc/connect";
import type { MethodInvoker } from "./invoker.js";

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
 * Creates a Proxy-based service client that allows method calls via property access.
 *
 * @param invoker - The MethodInvoker to use for method calls
 * @param serviceName - The fully-qualified service name
 * @param mergeSignals - Optional function to merge user signals with internal abort signal
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
 *
 * // With cancellation
 * const controller = new AbortController();
 * const response = await proxy.say({ sentence: "Hello" }, { signal: controller.signal });
 * ```
 */
export function createServiceProxy(
  invoker: MethodInvoker,
  serviceName: string,
  mergeSignals?: (userSignal?: AbortSignal) => AbortSignal,
): DynamicServiceProxy {
  return new Proxy({} as DynamicServiceProxy, {
    get(_target, methodName: string) {
      // Return a function that invokes the method
      return (
        requestOrRequests: unknown | AsyncIterable<unknown>,
        options?: CallOptions,
      ) => {
        const path = `${serviceName}/${methodName}`;

        // Merge signals if function is provided
        const mergedOptions: CallOptions | undefined = mergeSignals
          ? { ...options, signal: mergeSignals(options?.signal) }
          : options;

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
            mergedOptions,
          );
        } else {
          // For single input, try call first (unary or server streaming)
          // The invoker will handle the actual method kind
          return invoker.call(path, requestOrRequests, mergedOptions);
        }
      };
    },
  });
}
