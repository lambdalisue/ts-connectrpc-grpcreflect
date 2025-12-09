import type { createConnectRouter } from "@connectrpc/connect";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect } from "vitest";
import { createRouterTransport } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { ServerReflectionClient } from "./server_reflection_client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ServerReflectionClient (with auto-fallback)", () => {
  describe("version detection", () => {
    it("should detect v1 protocol from v1 server", async () => {
      // Load test file descriptor data
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      // Create test server with v1 reflection
      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);
      const testClient = new ServerReflectionClient(transport);

      try {
        // Trigger initialization by calling any method
        await testClient.listServices();

        // Should have detected v1
        expect(testClient.detectedVersion).toBe("v1");
      } finally {
        await testClient.close();
      }
    });

    it("should cache version detection across multiple calls", async () => {
      // Load test file descriptor data
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);
      const testClient = new ServerReflectionClient(transport);

      try {
        // Make multiple calls
        await testClient.listServices();
        await testClient.getServiceDescriptor(
          "grpc.reflection.v1.ServerReflection",
        );
        await testClient.getFileByFilename("v1/reflection.proto");

        // Version should be consistently detected as v1
        expect(testClient.detectedVersion).toBe("v1");
      } finally {
        await testClient.close();
      }
    });

    it("should return undefined for detectedVersion before initialization", () => {
      // Load test file descriptor data
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);
      const testClient = new ServerReflectionClient(transport);

      // Before any call, detectedVersion should be undefined
      expect(testClient.detectedVersion).toBeUndefined();

      testClient.close();
    });
  });
});
