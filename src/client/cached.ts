import type { CallOptions } from "@connectrpc/connect";
import type { FileDescriptorProto } from "@bufbuild/protobuf/wkt";
import type { FileRegistry } from "@bufbuild/protobuf";

import type {
  ServiceDescriptor,
  CacheStats,
  MethodDescriptor,
} from "./types.js";

/**
 * Interface for a server reflection client.
 * Any client implementing this interface can be wrapped by CachedServerReflectionClient.
 */
export interface IServerReflectionClient extends AsyncDisposable {
  /**
   * Lists all services available on the server.
   */
  listServices(options?: CallOptions): Promise<string[]>;

  /**
   * Retrieves the file descriptor for a file by its name.
   */
  getFileByFilename(
    filename: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto>;

  /**
   * Retrieves the file descriptor for a file containing the specified symbol.
   */
  getFileContainingSymbol(
    symbol: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto>;

  /**
   * Retrieves the file descriptor for a file containing an extension.
   */
  getFileContainingExtension(
    containingType: string,
    extensionNumber: number,
    options?: CallOptions,
  ): Promise<FileDescriptorProto>;

  /**
   * Retrieves all extension numbers for a given message type.
   */
  getAllExtensionNumbersOfType(
    type: string,
    options?: CallOptions,
  ): Promise<number[]>;

  /**
   * Retrieves the service descriptor for a given service name.
   */
  getServiceDescriptor(
    serviceName: string,
    options?: CallOptions,
  ): Promise<ServiceDescriptor>;

  /**
   * Retrieves the method descriptor for a specific method.
   */
  getMethodDescriptor(
    serviceName: string,
    methodName: string,
    options?: CallOptions,
  ): Promise<MethodDescriptor>;

  /**
   * Builds a complete FileRegistry containing all services.
   */
  buildFileRegistry(options?: CallOptions): Promise<FileRegistry>;

  /**
   * Closes the client.
   */
  close(): Promise<void>;

  /**
   * Whether the client has been disposed.
   */
  readonly disposed: boolean;
}

/**
 * Server reflection client with caching support.
 * Wraps any IServerReflectionClient and caches file descriptors and service descriptors to reduce network calls.
 *
 * This client implements AsyncDisposable for proper resource cleanup.
 * On disposal, caches are cleared and the wrapped client is disposed.
 */
export class CachedServerReflectionClient implements IServerReflectionClient {
  readonly #client: IServerReflectionClient;
  #fileByNameCache = new Map<string, FileDescriptorProto>();
  #fileBySymbolCache = new Map<string, FileDescriptorProto>();
  #serviceCache = new Map<string, ServiceDescriptor>();
  #servicesListCache: string[] | null = null;
  #stats = { hits: 0, misses: 0 };

  /**
   * Creates a new CachedServerReflectionClient.
   *
   * @param client - The ServerReflectionClient to wrap with caching
   */
  constructor(client: IServerReflectionClient) {
    this.#client = client;
  }

  /**
   * Returns whether this client has been disposed.
   */
  get disposed(): boolean {
    return this.#client.disposed;
  }

  /**
   * Lists all services available on the server (with caching).
   *
   * @param options - Optional call options including signal for cancellation
   * @returns Array of fully-qualified service names
   * @throws {ReflectionError} If the request fails
   */
  async listServices(options?: CallOptions): Promise<string[]> {
    if (this.#servicesListCache !== null) {
      this.#stats.hits++;
      return this.#servicesListCache;
    }

    this.#stats.misses++;
    const services = await this.#client.listServices(options);
    this.#servicesListCache = services;
    return services;
  }

  /**
   * Retrieves the file descriptor for a file by its name (with caching).
   *
   * @param filename - The proto file name
   * @param options - Optional call options including signal for cancellation
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the file is not found or request fails
   */
  async getFileByFilename(
    filename: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    const cached = this.#fileByNameCache.get(filename);
    if (cached) {
      this.#stats.hits++;
      return cached;
    }

    this.#stats.misses++;
    const file = await this.#client.getFileByFilename(filename, options);
    this.#fileByNameCache.set(filename, file);
    return file;
  }

  /**
   * Retrieves the file descriptor for a file containing the specified symbol (with caching).
   *
   * @param symbol - Fully-qualified symbol name
   * @param options - Optional call options including signal for cancellation
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the symbol is not found or request fails
   */
  async getFileContainingSymbol(
    symbol: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    const cached = this.#fileBySymbolCache.get(symbol);
    if (cached) {
      this.#stats.hits++;
      return cached;
    }

    this.#stats.misses++;
    const file = await this.#client.getFileContainingSymbol(symbol, options);
    this.#fileBySymbolCache.set(symbol, file);
    return file;
  }

  /**
   * Retrieves the service descriptor for a given service name (with caching).
   *
   * @param serviceName - Fully-qualified service name
   * @param options - Optional call options including signal for cancellation
   * @returns Service descriptor with methods and file information
   * @throws {ReflectionError} If the service is not found or request fails
   */
  async getServiceDescriptor(
    serviceName: string,
    options?: CallOptions,
  ): Promise<ServiceDescriptor> {
    const cached = this.#serviceCache.get(serviceName);
    if (cached) {
      this.#stats.hits++;
      return cached;
    }

    this.#stats.misses++;
    const service = await this.#client.getServiceDescriptor(
      serviceName,
      options,
    );
    this.#serviceCache.set(serviceName, service);
    return service;
  }

  /**
   * Retrieves the file descriptor for a file containing an extension.
   *
   * @param containingType - Fully-qualified name of the message type being extended
   * @param extensionNumber - The extension field number
   * @param options - Optional call options including signal for cancellation
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the extension is not found or request fails
   */
  async getFileContainingExtension(
    containingType: string,
    extensionNumber: number,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    return this.#client.getFileContainingExtension(
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
   * @throws {ReflectionError} If the request fails
   */
  async getAllExtensionNumbersOfType(
    type: string,
    options?: CallOptions,
  ): Promise<number[]> {
    return this.#client.getAllExtensionNumbersOfType(type, options);
  }

  /**
   * Retrieves the method descriptor for a specific method.
   *
   * @param serviceName - Fully-qualified service name
   * @param methodName - Simple method name
   * @param options - Optional call options including signal for cancellation
   * @returns Method descriptor
   * @throws {ReflectionError} If the method is not found or request fails
   */
  async getMethodDescriptor(
    serviceName: string,
    methodName: string,
    options?: CallOptions,
  ): Promise<MethodDescriptor> {
    return this.#client.getMethodDescriptor(serviceName, methodName, options);
  }

  /**
   * Builds a complete FileRegistry containing all services.
   *
   * @param options - Optional call options including signal for cancellation
   * @returns FileRegistry with all discovered services
   * @throws {ReflectionError} If the request fails
   */
  async buildFileRegistry(options?: CallOptions): Promise<FileRegistry> {
    return this.#client.buildFileRegistry(options);
  }

  /**
   * Clears all caches.
   */
  clearCache(): void {
    this.#fileByNameCache.clear();
    this.#fileBySymbolCache.clear();
    this.#serviceCache.clear();
    this.#servicesListCache = null;
  }

  /**
   * Clears only file-related caches.
   */
  clearFileCache(): void {
    this.#fileByNameCache.clear();
    this.#fileBySymbolCache.clear();
  }

  /**
   * Clears only service-related caches.
   */
  clearServiceCache(): void {
    this.#serviceCache.clear();
    this.#servicesListCache = null;
  }

  /**
   * Gets cache statistics.
   *
   * @returns Cache statistics including hits, misses, and entry counts
   */
  getCacheStats(): CacheStats {
    return {
      hits: this.#stats.hits,
      misses: this.#stats.misses,
      fileEntries: this.#fileByNameCache.size + this.#fileBySymbolCache.size,
      serviceEntries: this.#serviceCache.size,
    };
  }

  /**
   * Resets cache statistics (but keeps cached data).
   */
  resetCacheStats(): void {
    this.#stats.hits = 0;
    this.#stats.misses = 0;
  }

  /**
   * Closes this client, releasing resources.
   */
  async close(): Promise<void> {
    await this[Symbol.asyncDispose]();
  }

  /**
   * Disposes of this client, clearing caches and releasing resources.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    // Clear all caches
    this.clearCache();

    // Dispose of the wrapped client
    await this.#client.close();
  }
}
