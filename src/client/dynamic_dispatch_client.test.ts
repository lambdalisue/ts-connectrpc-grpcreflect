import type { createConnectRouter } from "@connectrpc/connect";
import type { FileRegistry } from "@bufbuild/protobuf";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import { Code, createRouterTransport } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { DynamicDispatchClient } from "./dynamic_dispatch_client.js";
import { ServerReflectionClient } from "./v1.js";
import { ReflectionError } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("DynamicDispatchClient", () => {
  let client: DynamicDispatchClient;
  let registry: FileRegistry;

  beforeAll(async () => {
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
    const reflectionClient = new ServerReflectionClient(transport);

    // Build registry and create DynamicDispatchClient
    registry = await reflectionClient.buildFileRegistry();
    client = new DynamicDispatchClient(transport, registry);
  });

  describe("call", () => {
    it("should invoke unary method with PascalCase method name", async () => {
      // ServerReflectionInfo is actually a bidi stream, so we test with bidiStream instead
      // For this test, we verify that the method lookup works with PascalCase
      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      const responses = client.bidiStream(
        "grpc.reflection.v1.ServerReflection",
        "ServerReflectionInfo",
        requests(),
      );

      const results: unknown[] = [];
      for await (const response of responses) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should invoke method with lowerCamelCase method name", async () => {
      // Test that localName (lowerCamelCase) also works
      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      const responses = client.bidiStream(
        "grpc.reflection.v1.ServerReflection",
        "serverReflectionInfo", // localName
        requests(),
      );

      const results: unknown[] = [];
      for await (const response of responses) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("bidiStream", () => {
    it("should invoke bidirectional streaming method", async () => {
      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      const responses = client.bidiStream(
        "grpc.reflection.v1.ServerReflection",
        "ServerReflectionInfo",
        requests(),
      );

      const results: unknown[] = [];
      for await (const response of responses) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
      // Verify the response contains service list
      const firstResponse = results[0] as {
        messageResponse?: {
          case?: string;
          value?: { service?: Array<{ name?: string }> };
        };
      };
      expect(firstResponse.messageResponse?.case).toBe("listServicesResponse");
    });
  });

  describe("error handling", () => {
    it("should throw ReflectionError for non-existent service", async () => {
      await expect(
        client.call("nonexistent.Service", "Method", {}),
      ).rejects.toThrow(ReflectionError);

      try {
        await client.call("nonexistent.Service", "Method", {});
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.NotFound);
        expect((error as ReflectionError).message).toContain(
          "Service not found",
        );
      }
    });

    it("should throw ReflectionError for non-existent method", async () => {
      await expect(
        client.call("grpc.reflection.v1.ServerReflection", "NonExistent", {}),
      ).rejects.toThrow(ReflectionError);

      try {
        await client.call(
          "grpc.reflection.v1.ServerReflection",
          "NonExistent",
          {},
        );
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.NotFound);
        expect((error as ReflectionError).message).toContain(
          "Method not found",
        );
      }
    });
  });

  describe("constructor", () => {
    it("should accept transport and registry", () => {
      const fileDescriptorData = readFileSync(
        join(__dirname, "../_gen/file_descriptor.binpb"),
      );

      const routes = (router: ReturnType<typeof createConnectRouter>) => {
        registerServerReflectionFromUint8Array(router, fileDescriptorData);
        return router;
      };

      const transport = createRouterTransport(routes);

      // This should not throw
      const newClient = new DynamicDispatchClient(transport, registry);
      expect(newClient).toBeInstanceOf(DynamicDispatchClient);
    });
  });
});
