import type { CallOptions, Client, Transport } from "@connectrpc/connect";
import { Code, createClient } from "@connectrpc/connect";
import {
  create,
  type DescService,
  type FileRegistry,
} from "@bufbuild/protobuf";

import { ReflectionError } from "./types.js";

/**
 * Dynamic gRPC client that dispatches method calls by service and method name.
 *
 * This client allows invoking gRPC methods dynamically without code generation,
 * using service and method names as strings. It supports all four gRPC streaming
 * patterns: unary, server streaming, client streaming, and bidirectional streaming.
 *
 * @example
 * ```typescript
 * // Build a FileRegistry from reflection or static descriptors
 * const reflection = new ServerReflectionClient(transport);
 * const registry = await reflection.buildFileRegistry();
 *
 * // Create the dynamic dispatch client
 * const client = new DynamicDispatchClient(transport, registry);
 *
 * // Invoke a unary method
 * const response = await client.call("echo.EchoService", "Say", { sentence: "Hello" });
 *
 * // Invoke a server streaming method
 * for await (const msg of client.serverStream("echo.EchoService", "SayStream", { sentence: "Hello" })) {
 *   console.log(msg);
 * }
 * ```
 */
export class DynamicDispatchClient {
  readonly #transport: Transport;
  readonly #registry: FileRegistry;
  readonly #clientCache = new Map<string, Client<DescService>>();

  /**
   * Creates a new DynamicDispatchClient.
   *
   * @param transport - The ConnectRPC transport to use for communication
   * @param registry - The FileRegistry containing service and message descriptors
   */
  constructor(transport: Transport, registry: FileRegistry) {
    this.#transport = transport;
    this.#registry = registry;
  }

  /**
   * Gets or creates a client for the given service.
   */
  #getClient(serviceName: string): Client<DescService> {
    let client = this.#clientCache.get(serviceName);
    if (!client) {
      const serviceDesc = this.#registry.getService(serviceName);
      if (!serviceDesc) {
        throw new ReflectionError(
          Code.NotFound,
          `Service not found: ${serviceName}`,
        );
      }
      client = createClient(serviceDesc, this.#transport);
      this.#clientCache.set(serviceName, client);
    }
    return client;
  }

  /**
   * Gets method descriptor and validates the method name.
   * Supports both localName (lowerCamelCase) and name (PascalCase).
   */
  #getMethodInfo(serviceName: string, methodName: string) {
    const serviceDesc = this.#registry.getService(serviceName);

    if (!serviceDesc) {
      throw new ReflectionError(
        Code.NotFound,
        `Service not found: ${serviceName}`,
      );
    }

    const method = serviceDesc.methods.find(
      (m) => m.name === methodName || m.localName === methodName,
    );

    if (!method) {
      throw new ReflectionError(
        Code.NotFound,
        `Method not found: ${serviceName}/${methodName}`,
      );
    }

    const client = this.#getClient(serviceName);
    const methodFn = (client as Record<string, unknown>)[method.localName] as (
      input: unknown,
      options?: CallOptions,
    ) => unknown;

    if (typeof methodFn !== "function") {
      throw new ReflectionError(
        Code.Internal,
        `Method function not found on client: ${method.localName}`,
      );
    }

    return { method, methodFn, serviceName };
  }

  /**
   * Creates a request message from plain object.
   */
  #createRequest(inputTypeName: string, data: unknown): unknown {
    const messageDesc = this.#registry.getMessage(inputTypeName);
    if (!messageDesc) {
      throw new ReflectionError(
        Code.NotFound,
        `Message type not found: ${inputTypeName}`,
      );
    }
    return create(messageDesc, data as Record<string, unknown>);
  }

  /**
   * Transforms requests by creating proper message instances.
   */
  async *#transformRequests(
    inputTypeName: string,
    requests: AsyncIterable<unknown>,
  ): AsyncIterable<unknown> {
    for await (const data of requests) {
      yield this.#createRequest(inputTypeName, data);
    }
  }

  /**
   * Invokes a unary method.
   *
   * @param service - Fully-qualified service name (e.g., "grpc.echo.EchoService")
   * @param method - Method name (e.g., "Say" or "say")
   * @param request - Request data as plain object
   * @param options - Optional call options including signal for cancellation
   * @returns Response as plain object
   * @throws {ReflectionError} If the service or method is not found
   *
   * @example
   * ```typescript
   * const response = await client.call("echo.EchoService", "Say", {
   *   sentence: "Hello, world!",
   * });
   *
   * // With cancellation
   * const controller = new AbortController();
   * const response = await client.call("echo.EchoService", "Say", {
   *   sentence: "Hello, world!",
   * }, { signal: controller.signal });
   * ```
   */
  async call(
    service: string,
    method: string,
    request: unknown,
    options?: CallOptions,
  ): Promise<unknown> {
    const { method: methodDesc, methodFn } = this.#getMethodInfo(
      service,
      method,
    );
    const req = this.#createRequest(methodDesc.input.typeName, request);
    return methodFn(req, options);
  }

  /**
   * Invokes a server streaming method.
   *
   * @param service - Fully-qualified service name
   * @param method - Method name
   * @param request - Request data as plain object
   * @param options - Optional call options including signal for cancellation
   * @returns Async iterable of response objects
   * @throws {ReflectionError} If the service or method is not found
   *
   * @example
   * ```typescript
   * for await (const response of client.serverStream("echo.EchoService", "SayStream", {
   *   sentence: "Hello",
   * })) {
   *   console.log(response);
   * }
   * ```
   */
  serverStream(
    service: string,
    method: string,
    request: unknown,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    const { method: methodDesc, methodFn } = this.#getMethodInfo(
      service,
      method,
    );
    const req = this.#createRequest(methodDesc.input.typeName, request);
    return methodFn(req, options) as AsyncIterable<unknown>;
  }

  /**
   * Invokes a client streaming method.
   *
   * @param service - Fully-qualified service name
   * @param method - Method name
   * @param requests - Async iterable of request data objects
   * @param options - Optional call options including signal for cancellation
   * @returns Response as plain object
   * @throws {ReflectionError} If the service or method is not found
   *
   * @example
   * ```typescript
   * async function* generateRequests() {
   *   yield { sentence: "Hello" };
   *   yield { sentence: "World" };
   * }
   * const response = await client.clientStream(
   *   "echo.EchoService",
   *   "SayClientStream",
   *   generateRequests(),
   * );
   * ```
   */
  async clientStream(
    service: string,
    method: string,
    requests: AsyncIterable<unknown>,
    options?: CallOptions,
  ): Promise<unknown> {
    const { method: methodDesc, methodFn } = this.#getMethodInfo(
      service,
      method,
    );
    return methodFn(
      this.#transformRequests(methodDesc.input.typeName, requests),
      options,
    );
  }

  /**
   * Invokes a bidirectional streaming method.
   *
   * @param service - Fully-qualified service name
   * @param method - Method name
   * @param requests - Async iterable of request data objects
   * @param options - Optional call options including signal for cancellation
   * @returns Async iterable of response objects
   * @throws {ReflectionError} If the service or method is not found
   *
   * @example
   * ```typescript
   * async function* generateRequests() {
   *   yield { sentence: "Hello" };
   *   yield { sentence: "World" };
   * }
   * for await (const response of client.bidiStream(
   *   "echo.EchoService",
   *   "SayBidi",
   *   generateRequests(),
   * )) {
   *   console.log(response);
   * }
   * ```
   */
  bidiStream(
    service: string,
    method: string,
    requests: AsyncIterable<unknown>,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    const { method: methodDesc, methodFn } = this.#getMethodInfo(
      service,
      method,
    );
    return methodFn(
      this.#transformRequests(methodDesc.input.typeName, requests),
      options,
    ) as AsyncIterable<unknown>;
  }
}
