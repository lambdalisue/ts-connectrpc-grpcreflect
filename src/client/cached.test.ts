import type { createConnectRouter } from "@connectrpc/connect";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import { createRouterTransport } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { CachedServerReflectionClient } from "./cached.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("CachedServerReflectionClient", () => {
  let client: CachedServerReflectionClient;

  beforeAll(() => {
    // Load test file descriptor data
    const fileDescriptorData = readFileSync(
      join(__dirname, "../_gen/file_descriptor.binpb"),
    );

    // Create test server with reflection
    const routes = (router: ReturnType<typeof createConnectRouter>) => {
      registerServerReflectionFromUint8Array(router, fileDescriptorData);
      return router;
    };

    // Create client with in-memory transport
    const transport = createRouterTransport(routes);
    client = new CachedServerReflectionClient(transport);
  });

  describe("caching behavior", () => {
    it("should cache getFileByFilename results", async () => {
      client.clearCache();
      client.resetCacheStats();

      // First call - should be a cache miss
      const file1 = await client.getFileByFilename("v1/reflection.proto");
      expect(file1).toBeDefined();

      const stats1 = client.getCacheStats();
      expect(stats1.misses).toBe(1);
      expect(stats1.hits).toBe(0);

      // Second call - should be a cache hit
      const file2 = await client.getFileByFilename("v1/reflection.proto");
      expect(file2).toBeDefined();

      const stats2 = client.getCacheStats();
      expect(stats2.hits).toBe(1);
      expect(stats2.misses).toBe(1);

      // Should be the same object reference
      expect(file2).toBe(file1);
    });

    it("should cache getFileContainingSymbol results", async () => {
      client.clearCache();
      client.resetCacheStats();

      const symbol = "grpc.reflection.v1.ServerReflection";

      // First call - cache miss
      const file1 = await client.getFileContainingSymbol(symbol);
      const stats1 = client.getCacheStats();
      expect(stats1.misses).toBe(1);

      // Second call - cache hit
      const file2 = await client.getFileContainingSymbol(symbol);
      const stats2 = client.getCacheStats();
      expect(stats2.hits).toBe(1);

      expect(file2).toBe(file1);
    });

    it("should cache service descriptors", async () => {
      client.clearCache();
      client.resetCacheStats();

      const serviceName = "grpc.reflection.v1.ServerReflection";

      // First call - cache miss
      const service1 = await client.getServiceDescriptor(serviceName);
      const stats1 = client.getCacheStats();
      expect(stats1.misses).toBeGreaterThan(0);

      // Second call - cache hit
      const service2 = await client.getServiceDescriptor(serviceName);
      const stats2 = client.getCacheStats();
      expect(stats2.hits).toBeGreaterThan(0);

      expect(service2).toBe(service1);
    });

    it("should cache listServices results", async () => {
      client.clearCache();
      client.resetCacheStats();

      // First call - cache miss
      const services1 = await client.listServices();
      const stats1 = client.getCacheStats();
      expect(stats1.misses).toBe(1);

      // Second call - cache hit
      const services2 = await client.listServices();
      const stats2 = client.getCacheStats();
      expect(stats2.hits).toBe(1);

      expect(services2).toBe(services1);
    });
  });

  describe("cache management", () => {
    it("should clear all caches", async () => {
      client.clearCache();
      client.resetCacheStats();

      // Populate cache
      await client.getFileByFilename("v1/reflection.proto");
      await client.listServices();

      const statsBefore = client.getCacheStats();
      expect(statsBefore.hits).toBe(0);
      expect(statsBefore.misses).toBe(2);

      // Clear cache and reset stats
      client.clearCache();
      client.resetCacheStats();

      // These should be cache misses again
      await client.getFileByFilename("v1/reflection.proto");
      await client.listServices();

      const statsAfter = client.getCacheStats();
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(2);
    });

    it("should clear specific cache entries", async () => {
      client.clearCache();
      client.resetCacheStats();

      // Populate cache
      await client.getFileByFilename("v1/reflection.proto");
      const services1 = await client.listServices();

      client.resetCacheStats();

      // Clear only file cache
      client.clearFileCache();

      // File should be cache miss
      await client.getFileByFilename("v1/reflection.proto");
      const statsFile = client.getCacheStats();
      expect(statsFile.misses).toBe(1);
      expect(statsFile.hits).toBe(0);

      // Services should still be cached (cache hit)
      const services2 = await client.listServices();
      const statsService = client.getCacheStats();
      expect(statsService.hits).toBe(1);

      expect(services2).toBe(services1);
    });
  });

  describe("cache statistics", () => {
    it("should track cache hits and misses", async () => {
      client.clearCache();
      client.resetCacheStats();

      // First call - miss
      await client.getFileByFilename("v1/reflection.proto");

      const stats1 = client.getCacheStats();
      expect(stats1.hits).toBe(0);
      expect(stats1.misses).toBe(1);

      // Second call - hit
      await client.getFileByFilename("v1/reflection.proto");

      const stats2 = client.getCacheStats();
      expect(stats2.hits).toBe(1);
      expect(stats2.misses).toBe(1);
    });

    it("should reset cache statistics", async () => {
      await client.getFileByFilename("v1/reflection.proto");
      await client.getFileByFilename("v1/reflection.proto");

      const stats1 = client.getCacheStats();
      expect(stats1.hits).toBeGreaterThan(0);

      client.resetCacheStats();

      const stats2 = client.getCacheStats();
      expect(stats2.hits).toBe(0);
      expect(stats2.misses).toBe(0);
    });
  });
});
