import type { CallOptions, Transport } from "@connectrpc/connect";
import type { DynamicServiceProxy } from "./proxy.js";
import { Code, createClient } from "@connectrpc/connect";
import {
  create,
  createFileRegistry,
  fromBinary,
  type FileRegistry,
} from "@bufbuild/protobuf";
import {
  FileDescriptorSetSchema,
  FileDescriptorProtoSchema,
  type FileDescriptorProto,
} from "@bufbuild/protobuf/wkt";

import {
  ServerReflection,
  ServerReflectionRequestSchema,
  type ServerReflectionRequest,
  type ServerReflectionResponse,
} from "../_gen/v1/reflection_pb.js";

import {
  ReflectionError,
  type ServiceDescriptor,
  type MethodDescriptor,
} from "./types.js";
import { MethodInvoker } from "./invoker.js";

export { ServerReflection } from "../_gen/v1/reflection_pb.js";

/**
 * Client for gRPC Server Reflection Protocol (v1).
 * Allows dynamic discovery of services and their definitions at runtime.
 *
 * This client implements AsyncDisposable for proper resource cleanup.
 * Use `await using` or call `close()` to release HTTP/2 connections.
 *
 * @example
 * ```typescript
 * // Using await using (recommended)
 * {
 *   await using client = new ServerReflectionClient(transport);
 *   const services = await client.listServices();
 * } // Automatically disposed
 *
 * // Using close() explicitly
 * const client = new ServerReflectionClient(transport);
 * try {
 *   const services = await client.listServices();
 * } finally {
 *   await client.close();
 * }
 * ```
 */
export class ServerReflectionClient implements AsyncDisposable {
  readonly #transport: Transport;
  readonly #abortController: AbortController;
  #client: ReturnType<typeof createClient<typeof ServerReflection>>;
  #invoker?: MethodInvoker;
  #registry?: FileRegistry;
  #disposed = false;

  /**
   * Creates a new ServerReflectionClient.
   *
   * @param transport - The ConnectRPC transport to use for communication
   * @param service - The ServerReflection service definition (for internal use by v1alpha)
   */
  constructor(
    transport: Transport,
    service: typeof ServerReflection = ServerReflection,
  ) {
    this.#transport = transport;
    this.#abortController = new AbortController();
    this.#client = createClient(service, transport);
  }

  /**
   * Returns whether this client has been disposed.
   */
  get disposed(): boolean {
    return this.#disposed;
  }

  /**
   * Disposes of this client, cancelling any pending requests.
   * Implements the AsyncDisposable interface for use with `await using`.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;

    // Abort any in-flight requests to release HTTP/2 connections
    this.#abortController.abort();
  }

  /**
   * Closes this client, releasing resources.
   * Alias for [Symbol.asyncDispose]() for explicit cleanup.
   */
  async close(): Promise<void> {
    await this[Symbol.asyncDispose]();
  }

  /**
   * Throws an error if this client has been disposed.
   */
  #ensureNotDisposed(): void {
    if (this.#disposed) {
      throw new ReflectionError(
        Code.Aborted,
        "ServerReflectionClient is disposed",
      );
    }
  }

  /**
   * Gets or creates the MethodInvoker for dynamic method calls.
   * Lazily initializes the invoker and caches the FileRegistry.
   */
  async #getInvoker(): Promise<MethodInvoker> {
    if (!this.#invoker) {
      if (!this.#registry) {
        this.#registry = await this.buildFileRegistry();
      }
      this.#invoker = new MethodInvoker(this.#transport, this.#registry);
    }
    return this.#invoker;
  }

  /**
   * Lists all services available on the server.
   *
   * @param options - Optional call options including signal for cancellation
   * @returns Array of fully-qualified service names
   * @throws {ReflectionError} If the request fails or client is disposed
   */
  async listServices(options?: CallOptions): Promise<string[]> {
    this.#ensureNotDisposed();

    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "listServices",
        value: "", // Value is ignored but required
      },
    });

    const response = await this.#sendRequest(request, options);

    if (response.messageResponse.case === "listServicesResponse") {
      return response.messageResponse.value.service.map((s) => s.name);
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the file descriptor for a file by its name.
   *
   * @param filename - The proto file name (e.g., "myservice.proto")
   * @param options - Optional call options including signal for cancellation
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the file is not found or request fails or client is disposed
   */
  async getFileByFilename(
    filename: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    this.#ensureNotDisposed();

    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "fileByFilename",
        value: filename,
      },
    });

    const response = await this.#sendRequest(request, options);

    if (response.messageResponse.case === "fileDescriptorResponse") {
      const descriptorData =
        response.messageResponse.value.fileDescriptorProto[0];
      if (!descriptorData) {
        throw new ReflectionError(Code.NotFound, `File not found: ${filename}`);
      }

      const fileDescriptorSet = create(FileDescriptorSetSchema, {
        file: response.messageResponse.value.fileDescriptorProto.map((data) =>
          fromBinary(FileDescriptorProtoSchema, data),
        ),
      });

      return fileDescriptorSet.file[0];
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the file descriptor for a file containing the specified symbol.
   *
   * @param symbol - Fully-qualified symbol name (e.g., "mypackage.MyService")
   * @param options - Optional call options including signal for cancellation
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the symbol is not found or request fails or client is disposed
   */
  async getFileContainingSymbol(
    symbol: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    this.#ensureNotDisposed();

    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "fileContainingSymbol",
        value: symbol,
      },
    });

    const response = await this.#sendRequest(request, options);

    if (response.messageResponse.case === "fileDescriptorResponse") {
      const descriptorData =
        response.messageResponse.value.fileDescriptorProto[0];
      if (!descriptorData) {
        throw new ReflectionError(Code.NotFound, `Symbol not found: ${symbol}`);
      }

      const fileDescriptorSet = create(FileDescriptorSetSchema, {
        file: response.messageResponse.value.fileDescriptorProto.map((data) =>
          fromBinary(FileDescriptorProtoSchema, data),
        ),
      });

      return fileDescriptorSet.file[0];
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the file descriptor for a file containing an extension.
   *
   * @param containingType - Fully-qualified name of the message type being extended
   * @param extensionNumber - The extension field number
   * @param options - Optional call options including signal for cancellation
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the extension is not found or request fails or client is disposed
   */
  async getFileContainingExtension(
    containingType: string,
    extensionNumber: number,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    this.#ensureNotDisposed();

    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "fileContainingExtension",
        value: {
          containingType,
          extensionNumber,
        },
      },
    });

    const response = await this.#sendRequest(request, options);

    if (response.messageResponse.case === "fileDescriptorResponse") {
      const descriptorData =
        response.messageResponse.value.fileDescriptorProto[0];
      if (!descriptorData) {
        throw new ReflectionError(
          Code.NotFound,
          `Extension not found: ${containingType}:${extensionNumber}`,
        );
      }

      const fileDescriptorSet = create(FileDescriptorSetSchema, {
        file: response.messageResponse.value.fileDescriptorProto.map((data) =>
          fromBinary(FileDescriptorProtoSchema, data),
        ),
      });

      return fileDescriptorSet.file[0];
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves all extension numbers for a given message type.
   *
   * @param type - Fully-qualified message type name
   * @param options - Optional call options including signal for cancellation
   * @returns Array of extension field numbers
   * @throws {ReflectionError} If the request fails or client is disposed
   */
  async getAllExtensionNumbersOfType(
    type: string,
    options?: CallOptions,
  ): Promise<number[]> {
    this.#ensureNotDisposed();

    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "allExtensionNumbersOfType",
        value: type,
      },
    });

    const response = await this.#sendRequest(request, options);

    if (response.messageResponse.case === "allExtensionNumbersResponse") {
      return response.messageResponse.value.extensionNumber;
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the service descriptor for a given service name.
   *
   * @param serviceName - Fully-qualified service name
   * @param options - Optional call options including signal for cancellation
   * @returns Service descriptor with methods and file information
   * @throws {ReflectionError} If the service is not found or request fails or client is disposed
   */
  async getServiceDescriptor(
    serviceName: string,
    options?: CallOptions,
  ): Promise<ServiceDescriptor> {
    this.#ensureNotDisposed();

    const file = await this.getFileContainingSymbol(serviceName, options);

    const service = file.service.find((s) => {
      const fullName = file.package ? `${file.package}.${s.name}` : s.name;
      return fullName === serviceName;
    });

    if (!service) {
      throw new ReflectionError(
        Code.NotFound,
        `Service not found in file: ${serviceName}`,
      );
    }

    const methods: MethodDescriptor[] = service.method.map((m) => ({
      name: m.name,
      fullName: `${serviceName}.${m.name}`,
      inputType: m.inputType.startsWith(".")
        ? m.inputType.slice(1)
        : m.inputType,
      outputType: m.outputType.startsWith(".")
        ? m.outputType.slice(1)
        : m.outputType,
      clientStreaming: m.clientStreaming,
      serverStreaming: m.serverStreaming,
    }));

    return {
      name: service.name,
      fullName: serviceName,
      methods,
      file,
    };
  }

  /**
   * Retrieves the method descriptor for a specific method.
   *
   * @param serviceName - Fully-qualified service name
   * @param methodName - Simple method name
   * @param options - Optional call options including signal for cancellation
   * @returns Method descriptor
   * @throws {ReflectionError} If the method is not found or request fails or client is disposed
   */
  async getMethodDescriptor(
    serviceName: string,
    methodName: string,
    options?: CallOptions,
  ): Promise<MethodDescriptor> {
    this.#ensureNotDisposed();

    const serviceDesc = await this.getServiceDescriptor(serviceName, options);
    const method = serviceDesc.methods.find((m) => m.name === methodName);

    if (!method) {
      throw new ReflectionError(
        Code.NotFound,
        `Method not found: ${serviceName}.${methodName}`,
      );
    }

    return method;
  }

  /**
   * Builds a complete FileRegistry containing all services.
   *
   * @param options - Optional call options including signal for cancellation
   * @returns FileRegistry with all discovered services
   * @throws {ReflectionError} If the request fails or client is disposed
   */
  async buildFileRegistry(options?: CallOptions): Promise<FileRegistry> {
    this.#ensureNotDisposed();

    const services = await this.listServices(options);
    const fileMap = new Map<string, FileDescriptorProto>();

    // Helper to recursively collect file and its dependencies
    const collectFileDependencies = async (file: FileDescriptorProto) => {
      // Process dependencies first (depth-first to resolve in correct order)
      for (const depName of file.dependency) {
        if (!fileMap.has(depName)) {
          // Dependency not yet collected, fetch it
          const depFile = await this.getFileByFilename(depName, options);
          // Recursively collect the dependency's dependencies
          await collectFileDependencies(depFile);
        }
      }

      // Add this file after its dependencies are added
      if (file.name) {
        fileMap.set(file.name, file);
      }
    };

    // Collect files for all services
    for (const serviceName of services) {
      const request = create(ServerReflectionRequestSchema, {
        messageRequest: {
          case: "fileContainingSymbol",
          value: serviceName,
        },
      });

      const response = await this.#sendRequest(request, options);

      if (response.messageResponse.case === "fileDescriptorResponse") {
        // Process all files returned by the server
        for (const data of response.messageResponse.value.fileDescriptorProto) {
          const file = fromBinary(FileDescriptorProtoSchema, data);
          if (file.name && !fileMap.has(file.name)) {
            await collectFileDependencies(file);
          }
        }
      }
    }

    // Create file descriptor set
    const fileDescriptorSet = create(FileDescriptorSetSchema, {
      file: Array.from(fileMap.values()),
    });

    return createFileRegistry(fileDescriptorSet);
  }

  /**
   * Merges the user-provided signal with the client's internal abort signal.
   */
  #mergeSignals(userSignal?: AbortSignal): AbortSignal {
    if (!userSignal) {
      return this.#abortController.signal;
    }
    return AbortSignal.any([this.#abortController.signal, userSignal]);
  }

  /**
   * Sends a reflection request and returns the response.
   * This is a low-level method used internally.
   *
   * @param request - The reflection request
   * @param options - Optional call options including signal for cancellation
   * @returns The reflection response
   * @throws {ReflectionError} If the request fails or client is disposed
   */
  async #sendRequest(
    request: ServerReflectionRequest,
    options?: CallOptions,
  ): Promise<ServerReflectionResponse> {
    // For bidirectional streaming, we create an async generator that yields our request
    async function* input() {
      yield request;
    }

    // Call the streaming method with our input and pass the merged abort signal
    const responses = this.#client.serverReflectionInfo(input(), {
      ...options,
      signal: this.#mergeSignals(options?.signal),
    });

    // Get the first (and only) response
    for await (const response of responses) {
      return response;
    }

    throw new ReflectionError(Code.Internal, "No response received");
  }

  // ============================================================
  // Dynamic Method Invocation API
  // ============================================================

  /**
   * Invokes a unary method dynamically.
   *
   * @param path - Full method path (e.g., "grpc.echo.EchoService/Say")
   * @param request - Request data as plain object
   * @param options - Optional call options including signal for cancellation
   * @returns Response as plain object
   * @throws {ReflectionError} If the method is not found or the request fails or client is disposed
   *
   * @example
   * ```typescript
   * const response = await client.call("grpc.echo.EchoService/Say", {
   *   sentence: "Hello, world!",
   * });
   *
   * // With cancellation
   * const controller = new AbortController();
   * const response = await client.call("grpc.echo.EchoService/Say", {
   *   sentence: "Hello, world!",
   * }, { signal: controller.signal });
   * ```
   */
  async call(
    path: string,
    request: unknown,
    options?: CallOptions,
  ): Promise<unknown> {
    this.#ensureNotDisposed();

    const invoker = await this.#getInvoker();
    return invoker.call(path, request, {
      ...options,
      signal: this.#mergeSignals(options?.signal),
    });
  }

  /**
   * Invokes a server streaming method dynamically.
   *
   * @param path - Full method path
   * @param request - Request data as plain object
   * @param options - Optional call options including signal for cancellation
   * @returns Async iterable of response objects
   * @throws {ReflectionError} If the method is not found or the request fails
   *
   * @example
   * ```typescript
   * for await (const response of client.serverStream("grpc.echo.EchoService/SayStream", {
   *   sentence: "Hello",
   * })) {
   *   console.log(response);
   * }
   *
   * // With cancellation
   * const controller = new AbortController();
   * for await (const response of client.serverStream("grpc.echo.EchoService/SayStream", {
   *   sentence: "Hello",
   * }, { signal: controller.signal })) {
   *   console.log(response);
   * }
   * ```
   */
  serverStream(
    path: string,
    request: unknown,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    // We need to return an async iterable immediately, so we wrap with an async generator
    return this.#createServerStream(path, request, options);
  }

  async *#createServerStream(
    path: string,
    request: unknown,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    this.#ensureNotDisposed();

    const invoker = await this.#getInvoker();
    yield* invoker.serverStream(path, request, {
      ...options,
      signal: this.#mergeSignals(options?.signal),
    });
  }

  /**
   * Invokes a client streaming method dynamically.
   *
   * @param path - Full method path
   * @param requests - Async iterable of request data objects
   * @param options - Optional call options including signal for cancellation
   * @returns Response as plain object
   * @throws {ReflectionError} If the method is not found or the request fails or client is disposed
   *
   * @example
   * ```typescript
   * async function* generateRequests() {
   *   yield { sentence: "Hello" };
   *   yield { sentence: "World" };
   * }
   * const response = await client.clientStream(
   *   "grpc.echo.EchoService/SayClientStream",
   *   generateRequests(),
   * );
   *
   * // With cancellation
   * const controller = new AbortController();
   * const response = await client.clientStream(
   *   "grpc.echo.EchoService/SayClientStream",
   *   generateRequests(),
   *   { signal: controller.signal },
   * );
   * ```
   */
  async clientStream(
    path: string,
    requests: AsyncIterable<unknown>,
    options?: CallOptions,
  ): Promise<unknown> {
    this.#ensureNotDisposed();

    const invoker = await this.#getInvoker();
    return invoker.clientStream(path, requests, {
      ...options,
      signal: this.#mergeSignals(options?.signal),
    });
  }

  /**
   * Invokes a bidirectional streaming method dynamically.
   *
   * @param path - Full method path
   * @param requests - Async iterable of request data objects
   * @param options - Optional call options including signal for cancellation
   * @returns Async iterable of response objects
   * @throws {ReflectionError} If the method is not found or the request fails
   *
   * @example
   * ```typescript
   * async function* generateRequests() {
   *   yield { sentence: "Hello" };
   *   yield { sentence: "World" };
   * }
   * for await (const response of client.bidiStream(
   *   "grpc.echo.EchoService/SayBidi",
   *   generateRequests(),
   * )) {
   *   console.log(response);
   * }
   *
   * // With cancellation
   * const controller = new AbortController();
   * for await (const response of client.bidiStream(
   *   "grpc.echo.EchoService/SayBidi",
   *   generateRequests(),
   *   { signal: controller.signal },
   * )) {
   *   console.log(response);
   * }
   * ```
   */
  bidiStream(
    path: string,
    requests: AsyncIterable<unknown>,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    // We need to return an async iterable immediately, so we wrap with an async generator
    return this.#createBidiStream(path, requests, options);
  }

  async *#createBidiStream(
    path: string,
    requests: AsyncIterable<unknown>,
    options?: CallOptions,
  ): AsyncIterable<unknown> {
    this.#ensureNotDisposed();

    const invoker = await this.#getInvoker();
    yield* invoker.bidiStream(path, requests, {
      ...options,
      signal: this.#mergeSignals(options?.signal),
    });
  }

  /**
   * Returns a Proxy-based service client for the specified service.
   * Allows calling methods directly by name.
   *
   * @param serviceName - Fully-qualified service name
   * @returns A proxy object that allows calling methods by name
   *
   * @example
   * ```typescript
   * const echo = client.service("grpc.echo.EchoService");
   *
   * // Call unary method
   * const response = await echo.say({ sentence: "Hello" });
   *
   * // Call streaming method
   * for await (const msg of echo.sayServerStream({ sentence: "Hello" })) {
   *   console.log(msg);
   * }
   *
   * // With cancellation
   * const controller = new AbortController();
   * const response = await echo.say({ sentence: "Hello" }, { signal: controller.signal });
   * ```
   */
  service(serviceName: string): DynamicServiceProxy {
    this.#ensureNotDisposed();

    // Bind methods for use in proxy handler
    const callMethod = this.call.bind(this);
    const bidiStreamMethod = this.bidiStream.bind(this);

    return new Proxy({} as DynamicServiceProxy, {
      get(_target, methodName: string) {
        return (
          requestOrRequests: unknown | AsyncIterable<unknown>,
          options?: CallOptions,
        ) => {
          const path = `${serviceName}/${methodName}`;

          // Detect if input is an async iterable (for streaming methods)
          const isAsyncIterable =
            requestOrRequests != null &&
            typeof requestOrRequests === "object" &&
            Symbol.asyncIterator in requestOrRequests;

          if (isAsyncIterable) {
            // For streaming input, use bidiStream
            return bidiStreamMethod(
              path,
              requestOrRequests as AsyncIterable<unknown>,
              options,
            );
          } else {
            // For single input, use call (unary or server streaming handled by invoker)
            return callMethod(path, requestOrRequests, options);
          }
        };
      },
    });
  }
}
