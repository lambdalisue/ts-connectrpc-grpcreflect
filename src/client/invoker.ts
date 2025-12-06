import type { CallOptions, Client, Transport } from "@connectrpc/connect";
import { Code, createClient } from "@connectrpc/connect";
import {
  create,
  type DescService,
  type FileRegistry,
} from "@bufbuild/protobuf";

import { ReflectionError } from "./types.js";

/**
 * Method kind for gRPC methods.
 */
export type MethodKind =
  | "unary"
  | "server_streaming"
  | "client_streaming"
  | "bidi_streaming";

/**
 * Parsed method path components.
 */
export interface ParsedPath {
  serviceName: string;
  methodName: string;
}

/**
 * Parses a method path into service and method names.
 *
 * @param path - Full method path (e.g., "grpc.echo.EchoService/Say")
 * @returns Parsed service and method names
 * @throws {ReflectionError} If the path format is invalid
 */
export function parsePath(path: string): ParsedPath {
  const slashIndex = path.lastIndexOf("/");
  if (slashIndex === -1) {
    throw new ReflectionError(
      Code.InvalidArgument,
      `Invalid method path: "${path}". Expected format: "package.Service/Method"`,
    );
  }

  const serviceName = path.slice(0, slashIndex);
  const methodName = path.slice(slashIndex + 1);

  if (!serviceName || !methodName) {
    throw new ReflectionError(
      Code.InvalidArgument,
      `Invalid method path: "${path}". Service name and method name cannot be empty`,
    );
  }

  return { serviceName, methodName };
}

/**
 * Gets the method kind from client/server streaming flags.
 */
export function getMethodKind(
  clientStreaming: boolean,
  serverStreaming: boolean,
): MethodKind {
  if (clientStreaming && serverStreaming) {
    return "bidi_streaming";
  } else if (clientStreaming) {
    return "client_streaming";
  } else if (serverStreaming) {
    return "server_streaming";
  }
  return "unary";
}

/**
 * Internal invoker for dynamic gRPC method calls.
 * Handles all four streaming types: unary, server, client, and bidirectional.
 */
export class MethodInvoker {
  readonly #transport: Transport;
  readonly #registry: FileRegistry;
  readonly #clientCache = new Map<string, Client<DescService>>();

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
   * Gets method descriptor and validates the path.
   */
  #getMethodInfo(path: string) {
    const { serviceName, methodName } = parsePath(path);
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
      throw new ReflectionError(Code.NotFound, `Method not found: ${path}`);
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
   * Invokes a unary method.
   *
   * @param path - Full method path (e.g., "grpc.echo.EchoService/Say")
   * @param request - Request data as plain object
   * @param options - Optional call options including signal for cancellation
   * @returns Response as plain object
   */
  async call(
    path: string,
    request: unknown,
    options?: CallOptions,
  ): Promise<unknown> {
    const { method, methodFn } = this.#getMethodInfo(path);
    const req = this.#createRequest(method.input.typeName, request);
    return methodFn(req, options);
  }

  /**
   * Invokes a server streaming method.
   *
   * @param path - Full method path
   * @param request - Request data as plain object
   * @param options - Optional call options including signal for cancellation
   * @returns Async iterable of response objects
   */
  serverStream(
    path: string,
    request: unknown,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    const { method, methodFn } = this.#getMethodInfo(path);
    const req = this.#createRequest(method.input.typeName, request);
    return methodFn(req, options) as AsyncIterable<unknown>;
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
   * Invokes a client streaming method.
   *
   * @param path - Full method path
   * @param requests - Async iterable of request data objects
   * @param options - Optional call options including signal for cancellation
   * @returns Response as plain object
   */
  async clientStream(
    path: string,
    requests: AsyncIterable<unknown>,
    options?: CallOptions,
  ): Promise<unknown> {
    const { method, methodFn } = this.#getMethodInfo(path);
    return methodFn(
      this.#transformRequests(method.input.typeName, requests),
      options,
    );
  }

  /**
   * Invokes a bidirectional streaming method.
   *
   * @param path - Full method path
   * @param requests - Async iterable of request data objects
   * @param options - Optional call options including signal for cancellation
   * @returns Async iterable of response objects
   */
  bidiStream(
    path: string,
    requests: AsyncIterable<unknown>,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    const { method, methodFn } = this.#getMethodInfo(path);
    return methodFn(
      this.#transformRequests(method.input.typeName, requests),
      options,
    ) as AsyncIterable<unknown>;
  }
}
