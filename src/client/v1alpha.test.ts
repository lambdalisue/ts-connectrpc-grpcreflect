import type { createConnectRouter } from "@connectrpc/connect";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import { Code, createRouterTransport  } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { ServerReflectionClient } from "./v1alpha.js";
import { ReflectionError } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ServerReflectionClient (v1alpha)", () => {
  let client: ServerReflectionClient;

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
    client = new ServerReflectionClient(transport);
  });

  describe("listServices", () => {
    it("should list all available services", async () => {
      const services = await client.listServices();

      expect(services).toBeInstanceOf(Array);
      expect(services.length).toBeGreaterThan(0);
      expect(services).toContain("grpc.reflection.v1alpha.ServerReflection");
    });
  });

  describe("getFileByFilename", () => {
    it("should retrieve file descriptor by filename", async () => {
      const file = await client.getFileByFilename("v1alpha/reflection.proto");

      expect(file).toBeDefined();
      expect(file.name).toBe("v1alpha/reflection.proto");
      expect(file.package).toBe("grpc.reflection.v1alpha");
    });

    it("should throw ReflectionError for non-existent file", async () => {
      await expect(
        client.getFileByFilename("nonexistent.proto"),
      ).rejects.toThrow(ReflectionError);

      try {
        await client.getFileByFilename("nonexistent.proto");
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.NotFound);
      }
    });
  });

  describe("getFileContainingSymbol", () => {
    it("should retrieve file containing a service symbol", async () => {
      const file = await client.getFileContainingSymbol(
        "grpc.reflection.v1alpha.ServerReflection",
      );

      expect(file).toBeDefined();
      expect(file.name).toBe("v1alpha/reflection.proto");
      expect(file.service.length).toBeGreaterThan(0);
    });

    it("should retrieve file containing a message symbol", async () => {
      const file = await client.getFileContainingSymbol(
        "grpc.reflection.v1alpha.ServerReflectionRequest",
      );

      expect(file).toBeDefined();
      expect(file.name).toBe("v1alpha/reflection.proto");
    });

    it("should throw ReflectionError for non-existent symbol", async () => {
      await expect(
        client.getFileContainingSymbol("nonexistent.Symbol"),
      ).rejects.toThrow(ReflectionError);

      try {
        await client.getFileContainingSymbol("nonexistent.Symbol");
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.NotFound);
      }
    });
  });

  describe("getServiceDescriptor", () => {
    it("should retrieve service descriptor with methods", async () => {
      const service = await client.getServiceDescriptor(
        "grpc.reflection.v1alpha.ServerReflection",
      );

      expect(service).toBeDefined();
      expect(service.name).toBe("ServerReflection");
      expect(service.fullName).toBe("grpc.reflection.v1alpha.ServerReflection");
      expect(service.methods).toBeInstanceOf(Array);
      expect(service.methods.length).toBeGreaterThan(0);
      expect(service.file).toBeDefined();

      // Check that ServerReflectionInfo method exists
      const method = service.methods.find(
        (m) => m.name === "ServerReflectionInfo",
      );
      expect(method).toBeDefined();
      expect(method?.clientStreaming).toBe(true);
      expect(method?.serverStreaming).toBe(true);
    });

    it("should throw ReflectionError for non-existent service", async () => {
      await expect(
        client.getServiceDescriptor("nonexistent.Service"),
      ).rejects.toThrow(ReflectionError);
    });
  });

  describe("getMethodDescriptor", () => {
    it("should retrieve method descriptor", async () => {
      const method = await client.getMethodDescriptor(
        "grpc.reflection.v1alpha.ServerReflection",
        "ServerReflectionInfo",
      );

      expect(method).toBeDefined();
      expect(method.name).toBe("ServerReflectionInfo");
      expect(method.fullName).toBe(
        "grpc.reflection.v1alpha.ServerReflection.ServerReflectionInfo",
      );
      expect(method.inputType).toBe(
        "grpc.reflection.v1alpha.ServerReflectionRequest",
      );
      expect(method.outputType).toBe(
        "grpc.reflection.v1alpha.ServerReflectionResponse",
      );
      expect(method.clientStreaming).toBe(true);
      expect(method.serverStreaming).toBe(true);
    });

    it("should throw ReflectionError for non-existent method", async () => {
      await expect(
        client.getMethodDescriptor(
          "grpc.reflection.v1alpha.ServerReflection",
          "NonExistentMethod",
        ),
      ).rejects.toThrow(ReflectionError);

      try {
        await client.getMethodDescriptor(
          "grpc.reflection.v1alpha.ServerReflection",
          "NonExistentMethod",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.NotFound);
      }
    });
  });

  describe("buildFileRegistry", () => {
    it("should build a complete file registry", async () => {
      const registry = await client.buildFileRegistry();

      expect(registry).toBeDefined();

      // Verify we can find services in the registry
      const service = registry.getService(
        "grpc.reflection.v1alpha.ServerReflection",
      );
      expect(service).toBeDefined();
    });

    it("should handle files with dependencies when building registry", async () => {
      // This test verifies that buildFileRegistry correctly handles
      // files that have dependencies on other proto files.
      // The server returns all files (main + dependencies) in a single response.

      const registry = await client.buildFileRegistry();

      // The test file descriptor we're using has dependencies
      // Verify we can access nested types across file boundaries
      const service = registry.getService("grpc.reflection.v1alpha.ServerReflection");
      expect(service).toBeDefined();

      // Verify we can access messages that might be in dependency files
      const requestMsg = registry.getMessage("grpc.reflection.v1alpha.ServerReflectionRequest");
      expect(requestMsg).toBeDefined();
      expect(requestMsg?.fields.length).toBeGreaterThan(0);
    });
  });

  describe("getAllExtensionNumbersOfType", () => {
    it("should return empty array for type without extensions", async () => {
      const extensions = await client.getAllExtensionNumbersOfType(
        "grpc.reflection.v1alpha.ServerReflectionRequest",
      );

      expect(extensions).toBeInstanceOf(Array);
      // The test proto doesn't have extensions, so should be empty
      expect(extensions.length).toBe(0);
    });
  });
});
