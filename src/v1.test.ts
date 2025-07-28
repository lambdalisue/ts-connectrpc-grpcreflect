import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeEach } from "vitest";
import { create, fromBinary } from "@bufbuild/protobuf";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";
import { Code } from "@connectrpc/connect";

import { ServerReflectionImpl } from "./v1.js";
import {
  ServerReflectionRequestSchema,
  type ServerReflectionRequest,
  type ServerReflectionResponse,
} from "./_gen/v1/reflection_pb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ServerReflectionImpl (v1)", () => {
  let serverReflection: ServerReflectionImpl;
  let fileDescriptorData: Uint8Array;

  beforeEach(() => {
    fileDescriptorData = readFileSync(
      join(__dirname, "_gen/file_descriptor.binpb"),
    );
    serverReflection = ServerReflectionImpl.fromUint8Array(fileDescriptorData);
  });

  describe("static factory methods", () => {
    it("should create instance from FileDescriptorSet", () => {
      const fileDescriptorSet = fromBinary(
        FileDescriptorSetSchema,
        fileDescriptorData,
      );
      const instance =
        ServerReflectionImpl.fromFileDescriptorSet(fileDescriptorSet);
      expect(instance).toBeInstanceOf(ServerReflectionImpl);
      expect(instance.registry).toBeDefined();
    });

    it("should create instance from Uint8Array", () => {
      const instance = ServerReflectionImpl.fromUint8Array(fileDescriptorData);
      expect(instance).toBeInstanceOf(ServerReflectionImpl);
      expect(instance.registry).toBeDefined();
    });

    it("should create instance from file", () => {
      const filePath = join(__dirname, "_gen/file_descriptor.binpb");
      const instance = ServerReflectionImpl.fromFile(filePath);
      expect(instance).toBeInstanceOf(ServerReflectionImpl);
      expect(instance.registry).toBeDefined();
    });
  });

  describe("serverReflectionInfo", () => {
    async function* createRequest(
      req: ServerReflectionRequest,
    ): AsyncGenerator<ServerReflectionRequest> {
      yield req;
    }

    async function collectResponses(
      responses: AsyncGenerator<ServerReflectionResponse>,
    ): Promise<ServerReflectionResponse[]> {
      const results: ServerReflectionResponse[] = [];
      for await (const response of responses) {
        results.push(response);
      }
      return results;
    }

    it("should handle fileByFilename request for existing file", async () => {
      const request = create(ServerReflectionRequestSchema, {
        host: "test.host",
        messageRequest: {
          case: "fileByFilename",
          value: "v1/reflection.proto",
        },
      });

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createRequest(request)),
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].validHost).toBe("test.host");
      expect(responses[0].messageResponse.case).toBe("fileDescriptorResponse");
      if (responses[0].messageResponse.case === "fileDescriptorResponse") {
        expect(
          responses[0].messageResponse.value.fileDescriptorProto,
        ).toHaveLength(1);
      }
    });

    it("should handle fileByFilename request for non-existing file", async () => {
      const request = create(ServerReflectionRequestSchema, {
        host: "test.host",
        messageRequest: {
          case: "fileByFilename",
          value: "non-existing.proto",
        },
      });

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createRequest(request)),
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].messageResponse.case).toBe("errorResponse");
      if (responses[0].messageResponse.case === "errorResponse") {
        expect(responses[0].messageResponse.value.errorCode).toBe(
          Code.NotFound,
        );
        expect(responses[0].messageResponse.value.errorMessage).toContain(
          "File not found",
        );
      }
    });

    it("should handle fileContainingSymbol request for existing symbol", async () => {
      const request = create(ServerReflectionRequestSchema, {
        host: "test.host",
        messageRequest: {
          case: "fileContainingSymbol",
          value: "grpc.reflection.v1.ServerReflection",
        },
      });

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createRequest(request)),
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].messageResponse.case).toBe("fileDescriptorResponse");
      if (responses[0].messageResponse.case === "fileDescriptorResponse") {
        expect(
          responses[0].messageResponse.value.fileDescriptorProto,
        ).toHaveLength(1);
      }
    });

    it("should handle fileContainingSymbol request for non-existing symbol", async () => {
      const request = create(ServerReflectionRequestSchema, {
        host: "test.host",
        messageRequest: {
          case: "fileContainingSymbol",
          value: "non.existing.Symbol",
        },
      });

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createRequest(request)),
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].messageResponse.case).toBe("errorResponse");
      if (responses[0].messageResponse.case === "errorResponse") {
        expect(responses[0].messageResponse.value.errorCode).toBe(
          Code.NotFound,
        );
      }
    });

    it("should handle listServices request", async () => {
      const request = create(ServerReflectionRequestSchema, {
        host: "test.host",
        messageRequest: {
          case: "listServices",
          value: "",
        },
      });

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createRequest(request)),
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].messageResponse.case).toBe("listServicesResponse");
      if (responses[0].messageResponse.case === "listServicesResponse") {
        const services = responses[0].messageResponse.value.service;
        expect(services.length).toBeGreaterThan(0);
        expect(
          services.some(
            (s) => s.name === "grpc.reflection.v1.ServerReflection",
          ),
        ).toBe(true);
      }
    });

    it("should handle allExtensionNumbersOfType request", async () => {
      const request = create(ServerReflectionRequestSchema, {
        host: "test.host",
        messageRequest: {
          case: "allExtensionNumbersOfType",
          value: "grpc.reflection.v1.ServerReflectionRequest",
        },
      });

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createRequest(request)),
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].messageResponse.case).toBe(
        "allExtensionNumbersResponse",
      );
      if (responses[0].messageResponse.case === "allExtensionNumbersResponse") {
        expect(responses[0].messageResponse.value.extensionNumber).toEqual([]);
      }
    });

    it("should handle empty request", async () => {
      const request = create(ServerReflectionRequestSchema, {
        host: "test.host",
        messageRequest: {
          case: undefined,
        },
      });

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createRequest(request)),
      );

      expect(responses).toHaveLength(1);
      expect(responses[0].validHost).toBe("test.host");
      expect(responses[0].originalRequest).toEqual(request);
    });

    it("should handle multiple requests in sequence", async () => {
      async function* createMultipleRequests(): AsyncGenerator<ServerReflectionRequest> {
        yield create(ServerReflectionRequestSchema, {
          host: "test.host",
          messageRequest: {
            case: "listServices",
            value: "",
          },
        });
        yield create(ServerReflectionRequestSchema, {
          host: "test.host",
          messageRequest: {
            case: "fileByFilename",
            value: "v1/reflection.proto",
          },
        });
      }

      const responses = await collectResponses(
        serverReflection.serverReflectionInfo(createMultipleRequests()),
      );

      expect(responses).toHaveLength(2);
      expect(responses[0].messageResponse.case).toBe("listServicesResponse");
      expect(responses[1].messageResponse.case).toBe("fileDescriptorResponse");
    });
  });
});
