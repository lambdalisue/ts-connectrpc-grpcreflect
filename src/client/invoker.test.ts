import type { createConnectRouter } from "@connectrpc/connect";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeAll } from "vitest";
import { Code, createRouterTransport } from "@connectrpc/connect";

import { registerServerReflectionFromUint8Array } from "../server/index.js";

import { parsePath, getMethodKind, MethodInvoker } from "./invoker.js";
import { ServerReflectionClient } from "./v1.js";
import { ReflectionError } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("invoker", () => {
  describe("parsePath", () => {
    it("should parse valid path with package", () => {
      const result = parsePath("grpc.echo.EchoService/Say");

      expect(result.serviceName).toBe("grpc.echo.EchoService");
      expect(result.methodName).toBe("Say");
    });

    it("should parse valid path without package", () => {
      const result = parsePath("EchoService/Say");

      expect(result.serviceName).toBe("EchoService");
      expect(result.methodName).toBe("Say");
    });

    it("should parse path with deeply nested package", () => {
      const result = parsePath("com.example.api.v1.EchoService/Say");

      expect(result.serviceName).toBe("com.example.api.v1.EchoService");
      expect(result.methodName).toBe("Say");
    });

    it("should throw ReflectionError for path without slash", () => {
      expect(() => parsePath("InvalidPath")).toThrow(ReflectionError);

      try {
        parsePath("InvalidPath");
      } catch (error) {
        expect(error).toBeInstanceOf(ReflectionError);
        expect((error as ReflectionError).code).toBe(Code.InvalidArgument);
      }
    });

    it("should throw ReflectionError for empty service name", () => {
      expect(() => parsePath("/Say")).toThrow(ReflectionError);
    });

    it("should throw ReflectionError for empty method name", () => {
      expect(() => parsePath("EchoService/")).toThrow(ReflectionError);
    });
  });

  describe("getMethodKind", () => {
    it("should return 'unary' for non-streaming method", () => {
      expect(getMethodKind(false, false)).toBe("unary");
    });

    it("should return 'server_streaming' for server streaming method", () => {
      expect(getMethodKind(false, true)).toBe("server_streaming");
    });

    it("should return 'client_streaming' for client streaming method", () => {
      expect(getMethodKind(true, false)).toBe("client_streaming");
    });

    it("should return 'bidi_streaming' for bidirectional streaming method", () => {
      expect(getMethodKind(true, true)).toBe("bidi_streaming");
    });
  });

  describe("MethodInvoker", () => {
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

    describe("bidiStream", () => {
      it("should invoke bidirectional streaming method", async () => {
        // ServerReflectionInfo is a bidi streaming method
        // Note: The request uses protobuf-es oneof format { case, value }
        async function* requests() {
          yield {
            messageRequest: {
              case: "listServices",
              value: "",
            },
          };
        }

        const responses = invoker.bidiStream(
          "grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
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
        expect(firstResponse.messageResponse?.case).toBe(
          "listServicesResponse",
        );
      });
    });

    describe("error handling", () => {
      it("should throw ReflectionError for non-existent service", async () => {
        await expect(
          invoker.call("nonexistent.Service/Method", {}),
        ).rejects.toThrow(ReflectionError);

        try {
          await invoker.call("nonexistent.Service/Method", {});
        } catch (error) {
          expect(error).toBeInstanceOf(ReflectionError);
          expect((error as ReflectionError).code).toBe(Code.NotFound);
        }
      });

      it("should throw ReflectionError for non-existent method", async () => {
        await expect(
          invoker.call("grpc.reflection.v1.ServerReflection/NonExistent", {}),
        ).rejects.toThrow(ReflectionError);
      });
    });
  });
});
