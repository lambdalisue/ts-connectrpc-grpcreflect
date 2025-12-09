import type { CallOptions, Transport } from "@connectrpc/connect";
import type { FileDescriptorProto } from "@bufbuild/protobuf/wkt";
import type { FileRegistry } from "@bufbuild/protobuf";

import type { ServiceDescriptor, MethodDescriptor } from "./types.js";
import { Code, ConnectError } from "@connectrpc/connect";

import { ServerReflectionClient as V1ServerReflectionClient } from "./v1.js";
import { ServerReflectionClient as V1alphaServerReflectionClient } from "./v1alpha.js";

/**
 * Helper function to check if an error is an UNIMPLEMENTED error.
 */
function isUnimplementedError(error: unknown): boolean {
  return error instanceof ConnectError && error.code === Code.Unimplemented;
}

/**
 * Reflection protocol version.
 */
type ReflectionVersion = "v1" | "v1alpha";

/**
 * Server reflection client with automatic v1/v1alpha version detection.
 *
 * This client automatically detects which reflection protocol version (v1 or v1alpha)
 * the server supports by trying v1 first and falling back to v1alpha if needed.
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
  #client?: V1ServerReflectionClient | V1alphaServerReflectionClient;
  #detectedVersion?: ReflectionVersion;
  #initPromise?: Promise<void>;
  #disposed = false;

  /**
   * Creates a new ServerReflectionClient with automatic version detection.
   *
   * @param transport - The ConnectRPC transport to use for communication
   */
  constructor(transport: Transport) {
    this.#transport = transport;
  }

  /**
   * Initializes the client by detecting the server's reflection protocol version.
   * Tries v1 first (recommended by spec), then falls back to v1alpha for legacy servers.
   */
  async #initialize(): Promise<void> {
    if (this.#client) return;
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = (async () => {
      // Try v1 first (recommended by gRPC spec)
      const v1Client = new V1ServerReflectionClient(this.#transport);

      try {
        await v1Client.listServices();
        this.#client = v1Client;
        this.#detectedVersion = "v1";
        return;
      } catch (error) {
        // Clean up v1 client if it failed
        await v1Client.close().catch(() => {
          // Ignore cleanup errors
        });

        if (isUnimplementedError(error)) {
          // Fallback to v1alpha for legacy servers
          const v1alphaClient = new V1alphaServerReflectionClient(
            this.#transport,
          );

          try {
            await v1alphaClient.listServices();
            this.#client = v1alphaClient;
            this.#detectedVersion = "v1alpha";
            return;
          } catch (fallbackError) {
            // Clean up v1alpha client if it failed
            await v1alphaClient.close().catch(() => {
              // Ignore cleanup errors
            });

            throw new Error(
              `Both reflection v1 and v1alpha failed. ` +
                `v1 error: ${error instanceof Error ? error.message : String(error)}, ` +
                `v1alpha error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
            );
          }
        }
        throw error;
      }
    })();

    return this.#initPromise;
  }

  /**
   * Get the detected reflection protocol version.
   * Returns undefined if not yet initialized.
   */
  get detectedVersion(): ReflectionVersion | undefined {
    return this.#detectedVersion;
  }

  /**
   * Returns whether this client has been disposed.
   */
  get disposed(): boolean {
    return this.#disposed;
  }

  /**
   * Lists all services available on the server.
   *
   * @param options - Optional call options including signal for cancellation
   * @returns Array of fully-qualified service names
   * @throws {ReflectionError} If the request fails or client is disposed
   */
  async listServices(options?: CallOptions): Promise<string[]> {
    await this.#initialize();
    return this.#client!.listServices(options);
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
    await this.#initialize();
    return this.#client!.getFileByFilename(filename, options);
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
    await this.#initialize();
    return this.#client!.getFileContainingSymbol(symbol, options);
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
    await this.#initialize();
    return this.#client!.getFileContainingExtension(
      containingType,
      extensionNumber,
      options,
    );
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
    await this.#initialize();
    return this.#client!.getAllExtensionNumbersOfType(type, options);
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
    await this.#initialize();
    return this.#client!.getServiceDescriptor(serviceName, options);
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
    await this.#initialize();
    return this.#client!.getMethodDescriptor(serviceName, methodName, options);
  }

  /**
   * Builds a complete FileRegistry containing all services.
   *
   * @param options - Optional call options including signal for cancellation
   * @returns FileRegistry with all discovered services
   * @throws {ReflectionError} If the request fails or client is disposed
   */
  async buildFileRegistry(options?: CallOptions): Promise<FileRegistry> {
    await this.#initialize();
    return this.#client!.buildFileRegistry(options);
  }

  /**
   * Closes this client, releasing resources.
   */
  async close(): Promise<void> {
    await this[Symbol.asyncDispose]();
  }

  /**
   * Disposes of this client, releasing resources.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;

    // Dispose of the underlying client if it exists
    if (this.#client) {
      await this.#client.close();
    }
  }
}
