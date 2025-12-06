import type { createConnectRouter } from "@connectrpc/connect";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import { Code, createRouterTransport } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { ServerReflectionClient } from "./v1.js";
import { ReflectionError } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ServerReflectionClient (v1)", () => {
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
      expect(services).toContain("grpc.reflection.v1.ServerReflection");
    });
  });

  describe("getFileByFilename", () => {
    it("should retrieve file descriptor by filename", async () => {
      const file = await client.getFileByFilename("v1/reflection.proto");

      expect(file).toBeDefined();
      expect(file.name).toBe("v1/reflection.proto");
      expect(file.package).toBe("grpc.reflection.v1");
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
        "grpc.reflection.v1.ServerReflection",
      );

      expect(file).toBeDefined();
      expect(file.name).toBe("v1/reflection.proto");
      expect(file.service.length).toBeGreaterThan(0);
    });

    it("should retrieve file containing a message symbol", async () => {
      const file = await client.getFileContainingSymbol(
        "grpc.reflection.v1.ServerReflectionRequest",
      );

      expect(file).toBeDefined();
      expect(file.name).toBe("v1/reflection.proto");
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
        "grpc.reflection.v1.ServerReflection",
      );

      expect(service).toBeDefined();
      expect(service.name).toBe("ServerReflection");
      expect(service.fullName).toBe("grpc.reflection.v1.ServerReflection");
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
        "grpc.reflection.v1.ServerReflection",
        "ServerReflectionInfo",
      );

      expect(method).toBeDefined();
      expect(method.name).toBe("ServerReflectionInfo");
      expect(method.fullName).toBe(
        "grpc.reflection.v1.ServerReflection.ServerReflectionInfo",
      );
      expect(method.inputType).toBe(
        "grpc.reflection.v1.ServerReflectionRequest",
      );
      expect(method.outputType).toBe(
        "grpc.reflection.v1.ServerReflectionResponse",
      );
      expect(method.clientStreaming).toBe(true);
      expect(method.serverStreaming).toBe(true);
    });

    it("should throw ReflectionError for non-existent method", async () => {
      await expect(
        client.getMethodDescriptor(
          "grpc.reflection.v1.ServerReflection",
          "NonExistentMethod",
        ),
      ).rejects.toThrow(ReflectionError);

      try {
        await client.getMethodDescriptor(
          "grpc.reflection.v1.ServerReflection",
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
        "grpc.reflection.v1.ServerReflection",
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
      const service = registry.getService(
        "grpc.reflection.v1.ServerReflection",
      );
      expect(service).toBeDefined();

      // Verify we can access messages that might be in dependency files
      const requestMsg = registry.getMessage(
        "grpc.reflection.v1.ServerReflectionRequest",
      );
      expect(requestMsg).toBeDefined();
      expect(requestMsg?.fields.length).toBeGreaterThan(0);
    });
  });

  describe("getAllExtensionNumbersOfType", () => {
    it("should return empty array for type without extensions", async () => {
      const extensions = await client.getAllExtensionNumbersOfType(
        "grpc.reflection.v1.ServerReflectionRequest",
      );

      expect(extensions).toBeInstanceOf(Array);
      // The test proto doesn't have extensions, so should be empty
      expect(extensions.length).toBe(0);
    });
  });

  describe("bidiStream (dynamic invocation)", () => {
    it("should invoke bidirectional streaming method using full path", async () => {
      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      const responses = client.bidiStream(
        "grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
        requests(),
      );

      const results: unknown[] = [];
      for await (const response of responses) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
      const firstResponse = results[0] as {
        messageResponse?: {
          case?: string;
          value?: { service?: Array<{ name?: string }> };
        };
      };
      expect(firstResponse.messageResponse?.case).toBe("listServicesResponse");
    });
  });

  describe("service (Proxy-based client)", () => {
    it("should return a proxy that allows method calls via property access", async () => {
      const proxy = client.service("grpc.reflection.v1.ServerReflection");

      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      // Access method via camelCase name
      const responses = proxy.serverReflectionInfo(requests());

      const results: unknown[] = [];
      for await (const response of responses as AsyncIterable<unknown>) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("disposal", () => {
    it("should implement AsyncDisposable interface", async () => {
      // Load test file descriptor data
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      // Create test server with reflection
      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);
      const disposableClient = new ServerReflectionClient(transport);

      // Verify we can call methods before disposal
      const services = await disposableClient.listServices();
      expect(services.length).toBeGreaterThan(0);

      // Verify disposed is false before disposal
      expect(disposableClient.disposed).toBe(false);

      // Dispose the client
      await disposableClient[Symbol.asyncDispose]();

      // Verify disposed is true after disposal
      expect(disposableClient.disposed).toBe(true);
    });

    it("should throw error when calling methods after disposal", async () => {
      // Load test file descriptor data
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      // Create test server with reflection
      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);
      const disposableClient = new ServerReflectionClient(transport);

      // Dispose the client
      await disposableClient.close();

      // Verify all methods throw after disposal
      await expect(disposableClient.listServices()).rejects.toThrow("disposed");
      await expect(
        disposableClient.getFileByFilename("test.proto"),
      ).rejects.toThrow("disposed");
      await expect(
        disposableClient.getFileContainingSymbol("test.Symbol"),
      ).rejects.toThrow("disposed");
      await expect(
        disposableClient.getServiceDescriptor("test.Service"),
      ).rejects.toThrow("disposed");
      await expect(
        disposableClient.getMethodDescriptor("test.Service", "Method"),
      ).rejects.toThrow("disposed");
      await expect(disposableClient.buildFileRegistry()).rejects.toThrow(
        "disposed",
      );
      await expect(
        disposableClient.call("test.Service/Method", {}),
      ).rejects.toThrow("disposed");
    });

    it("should support multiple dispose calls (idempotent)", async () => {
      // Load test file descriptor data
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      // Create test server with reflection
      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);
      const disposableClient = new ServerReflectionClient(transport);

      // Dispose multiple times should not throw
      await disposableClient.close();
      await disposableClient.close();
      await disposableClient[Symbol.asyncDispose]();

      expect(disposableClient.disposed).toBe(true);
    });

    it("should work with await using syntax", async () => {
      // Load test file descriptor data
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      // Create test server with reflection
      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);

      let clientRef: ServerReflectionClient | undefined;

      {
        await using disposableClient = new ServerReflectionClient(transport);
        clientRef = disposableClient;

        // Should work inside the block
        const services = await disposableClient.listServices();
        expect(services.length).toBeGreaterThan(0);
        expect(disposableClient.disposed).toBe(false);
      }

      // After the block, client should be disposed
      expect(clientRef!.disposed).toBe(true);
      await expect(clientRef!.listServices()).rejects.toThrow("disposed");
    });
  });

  describe("signal option", () => {
    it("should accept signal option in listServices", async () => {
      const abortController = new AbortController();
      const services = await client.listServices({
        signal: abortController.signal,
      });
      expect(services.length).toBeGreaterThan(0);
    });

    it("should accept signal option in getFileByFilename", async () => {
      const abortController = new AbortController();
      const file = await client.getFileByFilename("v1/reflection.proto", {
        signal: abortController.signal,
      });
      expect(file).toBeDefined();
    });

    it("should accept signal option in getServiceDescriptor", async () => {
      const abortController = new AbortController();
      const service = await client.getServiceDescriptor(
        "grpc.reflection.v1.ServerReflection",
        { signal: abortController.signal },
      );
      expect(service).toBeDefined();
    });

    it("should cancel request when signal is aborted", async () => {
      const abortController = new AbortController();
      // Abort immediately
      abortController.abort();

      await expect(
        client.listServices({ signal: abortController.signal }),
      ).rejects.toThrow();
    });

    it("should accept signal option in call()", async () => {
      const abortController = new AbortController();

      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      // First verify call works without signal
      const responses = client.bidiStream(
        "grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
        requests(),
        { signal: abortController.signal },
      );

      const results: unknown[] = [];
      for await (const response of responses) {
        results.push(response);
        break; // Only need first response
      }
      expect(results.length).toBeGreaterThan(0);
    });

    it("should cancel bidiStream when signal is aborted", async () => {
      const abortController = new AbortController();
      // Abort immediately
      abortController.abort();

      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      const responses = client.bidiStream(
        "grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
        requests(),
        { signal: abortController.signal },
      );

      await expect(async () => {
        for await (const _response of responses) {
          // Should not reach here
        }
      }).rejects.toThrow();
    });

    it("should accept signal option in service() proxy", async () => {
      const abortController = new AbortController();

      const proxy = client.service("grpc.reflection.v1.ServerReflection");

      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      const responses = proxy.serverReflectionInfo(requests(), {
        signal: abortController.signal,
      });

      const results: unknown[] = [];
      for await (const response of responses as AsyncIterable<unknown>) {
        results.push(response);
        break; // Only need first response
      }
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
