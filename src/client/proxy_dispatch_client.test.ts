import type { createConnectRouter, Transport } from "@connectrpc/connect";
import type { FileRegistry } from "@bufbuild/protobuf";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import { Code, createRouterTransport } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { ProxyDispatchClient } from "./proxy_dispatch_client.js";
import { ServerReflectionClient } from "./v1.js";
import { ReflectionError } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ProxyDispatchClient", () => {
  let transport: Transport;
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
    transport = createRouterTransport(routes);
    const reflectionClient = new ServerReflectionClient(transport);

    // Build registry
    registry = await reflectionClient.buildFileRegistry();
  });

  describe("method invocation via property access", () => {
    it("should invoke method via localName (lowerCamelCase)", async () => {
      const reflection = new ProxyDispatchClient(
        transport,
        registry,
        "grpc.reflection.v1.ServerReflection",
      );

      // Use async iterable input to invoke bidiStream
      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      // serverReflectionInfo (localName) should work
      const responses = reflection.serverReflectionInfo(requests());

      const results: unknown[] = [];
      for await (const response of responses as AsyncIterable<unknown>) {
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

    it("should invoke method via PascalCase name", async () => {
      const reflection = new ProxyDispatchClient(
        transport,
        registry,
        "grpc.reflection.v1.ServerReflection",
      );

      // Use async iterable input to invoke bidiStream
      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      // ServerReflectionInfo (PascalCase) should also work
      const responses = reflection.ServerReflectionInfo(requests());

      const results: unknown[] = [];
      for await (const response of responses as AsyncIterable<unknown>) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("streaming detection", () => {
    it("should detect async iterable input and use bidiStream", async () => {
      const reflection = new ProxyDispatchClient(
        transport,
        registry,
        "grpc.reflection.v1.ServerReflection",
      );

      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      // Passing an async iterable should route to bidiStream
      const responses = reflection.serverReflectionInfo(requests());

      // The result should be an async iterable
      expect(Symbol.asyncIterator in (responses as object)).toBe(true);

      const results: unknown[] = [];
      for await (const response of responses as AsyncIterable<unknown>) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should throw ReflectionError for non-existent method", async () => {
      const reflection = new ProxyDispatchClient(
        transport,
        registry,
        "grpc.reflection.v1.ServerReflection",
      );

      // Calling a non-existent method should throw
      await expect(reflection.nonExistentMethod({})).rejects.toThrow(
        ReflectionError,
      );

      try {
        await reflection.nonExistentMethod({});
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.NotFound);
      }
    });

    it("should throw ReflectionError for non-existent service", async () => {
      const badClient = new ProxyDispatchClient(
        transport,
        registry,
        "nonexistent.Service",
      );

      await expect(badClient.someMethod({})).rejects.toThrow(ReflectionError);

      try {
        await badClient.someMethod({});
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.NotFound);
        expect((error as ReflectionError).message).toContain(
          "Service not found",
        );
      }
    });
  });

  describe("constructor", () => {
    it("should return a proxy object", () => {
      const proxy = new ProxyDispatchClient(
        transport,
        registry,
        "grpc.reflection.v1.ServerReflection",
      );

      // The result should be usable as a proxy
      expect(typeof proxy.serverReflectionInfo).toBe("function");
      expect(typeof proxy.anyMethodName).toBe("function");
    });
  });
});
