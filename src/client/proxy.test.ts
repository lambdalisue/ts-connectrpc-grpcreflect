import type { createConnectRouter } from "@connectrpc/connect";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import { createRouterTransport } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { createServiceProxy } from "./proxy.js";
import { MethodInvoker } from "./invoker.js";
import { ServerReflectionClient } from "./v1.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("proxy", () => {
  describe("createServiceProxy", () => {
    let invoker: MethodInvoker;

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
      const client = new ServerReflectionClient(transport);

      // Build registry and create invoker
      const registry = await client.buildFileRegistry();
      invoker = new MethodInvoker(transport, registry);
    });

    it("should create a proxy that allows method calls via property access", async () => {
      const proxy = createServiceProxy(
        invoker,
        "grpc.reflection.v1.ServerReflection",
      );

      // ServerReflectionInfo is a bidi streaming method
      // Access it via localName (camelCase)
      async function* requests() {
        yield {
          messageRequest: {
            case: "listServices",
            value: "",
          },
        };
      }

      const responses = proxy.serverReflectionInfo(requests());

      const results: unknown[] = [];
      for await (const response of responses as AsyncIterable<unknown>) {
        results.push(response);
      }

      expect(results.length).toBeGreaterThan(0);
    });

    it("should throw error for non-existent method", async () => {
      const proxy = createServiceProxy(
        invoker,
        "grpc.reflection.v1.ServerReflection",
      );

      // Accessing a non-existent method should throw when awaited
      await expect(proxy.nonExistentMethod({})).rejects.toThrow(
        "Method not found",
      );
    });
  });
});
