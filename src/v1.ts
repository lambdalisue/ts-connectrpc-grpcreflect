import { readFileSync } from "node:fs";

import { type ServiceImpl, Code } from "@connectrpc/connect";
import {
  create,
  fromBinary,
  createFileRegistry,
  type FileRegistry,
} from "@bufbuild/protobuf";
import {
  FileDescriptorSetSchema,
  type FileDescriptorSet,
} from "@bufbuild/protobuf/wkt";

import {
  type ServerReflection,
  ServerReflectionResponseSchema,
  ListServiceResponseSchema,
  type ServerReflectionRequest,
  type ServerReflectionResponse,
  ExtensionNumberResponseSchema,
  FileDescriptorResponseSchema,
  ErrorResponseSchema,
} from "./_gen/v1/reflection_pb.js";
import {
  getFileByFilename,
  getListServices,
  getFileContainingSymbol,
  getFileContainingExtension,
  getAllExtensionNumbersOfType,
} from "./registry.js";

export { ServerReflection } from "./_gen/v1/reflection_pb.js";

/**
 * Implementation of the gRPC Server Reflection service (v1).
 * Provides runtime information about gRPC services, methods, and types.
 */
export class ServerReflectionImpl
  implements ServiceImpl<typeof ServerReflection>
{
  /**
   * Creates a new ServerReflectionImpl instance.
   *
   * @param registry - The file registry containing protobuf file descriptors
   */
  constructor(public readonly registry: FileRegistry) {}

  /**
   * Creates a ServerReflectionImpl from a FileDescriptorSet.
   *
   * @param fileDescriptorSet - The FileDescriptorSet to create the reflection service from
   * @returns A new ServerReflectionImpl instance
   */
  static fromFileDescriptorSet(
    fileDescriptorSet: FileDescriptorSet,
  ): ServerReflectionImpl {
    const registry = createFileRegistry(fileDescriptorSet);
    return new ServerReflectionImpl(registry);
  }

  /**
   * Creates a ServerReflectionImpl from binary-encoded FileDescriptorSet data.
   *
   * @param data - The binary-encoded FileDescriptorSet data
   * @returns A new ServerReflectionImpl instance
   */
  static fromUint8Array(data: Uint8Array): ServerReflectionImpl {
    const fileDescriptorSet = fromBinary(FileDescriptorSetSchema, data);
    return ServerReflectionImpl.fromFileDescriptorSet(fileDescriptorSet);
  }

  /**
   * Creates a ServerReflectionImpl by reading a FileDescriptorSet from a file.
   *
   * @param path - The file path to the binary-encoded FileDescriptorSet
   * @returns A new ServerReflectionImpl instance
   */
  static fromFile(path: string): ServerReflectionImpl {
    const data = readFileSync(path);
    return ServerReflectionImpl.fromUint8Array(data);
  }

  /**
   * Handles bidirectional streaming server reflection requests.
   * Processes various reflection queries including file lookups, symbol queries,
   * extension information, and service listings.
   *
   * @param reqs - An async iterable of ServerReflectionRequest messages
   * @yields ServerReflectionResponse messages for each request
   */
  async *serverReflectionInfo(
    reqs: AsyncIterable<ServerReflectionRequest>,
  ): AsyncGenerator<ServerReflectionResponse> {
    for await (const req of reqs) {
      const res = create(ServerReflectionResponseSchema, {
        validHost: req.host,
        originalRequest: req,
      });

      switch (req.messageRequest.case) {
        case "fileByFilename": {
          const file = getFileByFilename(
            this.registry,
            req.messageRequest.value,
          );
          res.messageResponse = file
            ? {
                case: "fileDescriptorResponse",
                value: create(FileDescriptorResponseSchema, {
                  fileDescriptorProto: [file],
                }),
              }
            : {
                case: "errorResponse",
                value: create(ErrorResponseSchema, {
                  errorCode: Code.NotFound,
                  errorMessage: `File not found: ${req.messageRequest.value}`,
                }),
              };
          break;
        }
        case "fileContainingSymbol": {
          const file = getFileContainingSymbol(
            this.registry,
            req.messageRequest.value,
          );
          res.messageResponse = file
            ? {
                case: "fileDescriptorResponse",
                value: create(FileDescriptorResponseSchema, {
                  fileDescriptorProto: [file],
                }),
              }
            : {
                case: "errorResponse",
                value: create(ErrorResponseSchema, {
                  errorCode: Code.NotFound,
                  errorMessage: `File not found: ${req.messageRequest.value}`,
                }),
              };
          break;
        }
        case "fileContainingExtension": {
          const file = getFileContainingExtension(
            this.registry,
            req.messageRequest.value.containingType,
            req.messageRequest.value.extensionNumber,
          );
          res.messageResponse = file
            ? {
                case: "fileDescriptorResponse",
                value: create(FileDescriptorResponseSchema, {
                  fileDescriptorProto: [file],
                }),
              }
            : {
                case: "errorResponse",
                value: create(ErrorResponseSchema, {
                  errorCode: Code.NotFound,
                  errorMessage: `File not found: ${req.messageRequest.value}`,
                }),
              };
          break;
        }
        case "allExtensionNumbersOfType": {
          const numbers = getAllExtensionNumbersOfType(
            this.registry,
            req.messageRequest.value,
          );
          res.messageResponse = {
            case: "allExtensionNumbersResponse",
            value: create(ExtensionNumberResponseSchema, {
              extensionNumber: numbers,
            }),
          };
          break;
        }
        case "listServices": {
          const serviceNames = getListServices(
            this.registry,
            req.messageRequest.value,
          );
          res.messageResponse = {
            case: "listServicesResponse",
            value: create(ListServiceResponseSchema, {
              service: serviceNames.map((name) => ({ name })),
            }),
          };
          break;
        }
        case undefined: {
          // Handle empty request
          break;
        }
        default:
          throw new Error(
            `Unknown request: ${JSON.stringify(req.messageRequest satisfies never, null, 2)}`,
          );
      }
      yield res;
    }
  }
}
