import type { CallOptions, Transport } from "@connectrpc/connect";
import type { FileDescriptorProto } from "@bufbuild/protobuf/wkt";

import type { ServiceDescriptor, CacheStats } from "./types.js";
import { ServerReflectionClient } from "./v1.js";

/**
 * Server reflection client with caching support.
 * Caches file descriptors and service descriptors to reduce network calls.
 *
 * This client implements AsyncDisposable for proper resource cleanup.
 * On disposal, caches are cleared and parent resources are released.
 */
export class CachedServerReflectionClient extends ServerReflectionClient {
  #fileByNameCache = new Map<string, FileDescriptorProto>();
  #fileBySymbolCache = new Map<string, FileDescriptorProto>();
  #serviceCache = new Map<string, ServiceDescriptor>();
  #servicesListCache: string[] | null = null;
  #stats = { hits: 0, misses: 0 };

  /**
   * Creates a new CachedServerReflectionClient.
   *
   * @param transport - The ConnectRPC transport to use for communication
   */
  constructor(transport: Transport) {
    super(transport);
  }

  /**
   * Lists all services available on the server (with caching).
   *
   * @param options - Optional call options including signal for cancellation
   * @returns Array of fully-qualified service names
   * @throws {ReflectionError} If the request fails
   */
  override async listServices(options?: CallOptions): Promise<string[]> {
    if (this.#servicesListCache !== null) {
      this.#stats.hits++;
      return this.#servicesListCache;
    }

    this.#stats.misses++;
    const services = await super.listServices(options);
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
  override async getFileByFilename(
    filename: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    const cached = this.#fileByNameCache.get(filename);
    if (cached) {
      this.#stats.hits++;
      return cached;
    }

    this.#stats.misses++;
    const file = await super.getFileByFilename(filename, options);
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
  override async getFileContainingSymbol(
    symbol: string,
    options?: CallOptions,
  ): Promise<FileDescriptorProto> {
    const cached = this.#fileBySymbolCache.get(symbol);
    if (cached) {
      this.#stats.hits++;
      return cached;
    }

    this.#stats.misses++;
    const file = await super.getFileContainingSymbol(symbol, options);
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
  override async getServiceDescriptor(
    serviceName: string,
    options?: CallOptions,
  ): Promise<ServiceDescriptor> {
    const cached = this.#serviceCache.get(serviceName);
    if (cached) {
      this.#stats.hits++;
      return cached;
    }

    this.#stats.misses++;
    const service = await super.getServiceDescriptor(serviceName, options);
    this.#serviceCache.set(serviceName, service);
    return service;
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
   * Disposes of this client, clearing caches and releasing resources.
   * Overrides parent to also clear caches.
   */
  override async [Symbol.asyncDispose](): Promise<void> {
    // Clear all caches
    this.clearCache();

    // Call parent dispose
    await super[Symbol.asyncDispose]();
  }
}
