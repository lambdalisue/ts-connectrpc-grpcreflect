import type { Transport } from "@connectrpc/connect";
import { Code, createClient } from "@connectrpc/connect";
import { create, createFileRegistry, fromBinary, type FileRegistry } from "@bufbuild/protobuf";
import {
  FileDescriptorSetSchema,
  FileDescriptorProtoSchema,
  type FileDescriptorProto,
} from "@bufbuild/protobuf/wkt";

import {
  ServerReflection,
  ServerReflectionRequestSchema,
  type ServerReflectionRequest,
  type ServerReflectionResponse,
} from "../_gen/v1/reflection_pb.js";

import {
  ReflectionError,
  type ServiceDescriptor,
  type MethodDescriptor,
} from "./types.js";

export { ServerReflection } from "../_gen/v1/reflection_pb.js";

/**
 * Client for gRPC Server Reflection Protocol (v1).
 * Allows dynamic discovery of services and their definitions at runtime.
 */
export class ServerReflectionClient {
  #client: ReturnType<typeof createClient<typeof ServerReflection>>;

  /**
   * Creates a new ServerReflectionClient.
   *
   * @param transport - The ConnectRPC transport to use for communication
   * @param service - The ServerReflection service definition (for internal use by v1alpha)
   */
  constructor(
    transport: Transport,
    service: typeof ServerReflection = ServerReflection,
  ) {
    this.#client = createClient(service, transport);
  }

  /**
   * Lists all services available on the server.
   *
   * @returns Array of fully-qualified service names
   * @throws {ReflectionError} If the request fails
   */
  async listServices(): Promise<string[]> {
    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "listServices",
        value: "", // Value is ignored but required
      },
    });

    const response = await this.#sendRequest(request);

    if (response.messageResponse.case === "listServicesResponse") {
      return response.messageResponse.value.service.map((s) => s.name);
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the file descriptor for a file by its name.
   *
   * @param filename - The proto file name (e.g., "myservice.proto")
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the file is not found or request fails
   */
  async getFileByFilename(filename: string): Promise<FileDescriptorProto> {
    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "fileByFilename",
        value: filename,
      },
    });

    const response = await this.#sendRequest(request);

    if (response.messageResponse.case === "fileDescriptorResponse") {
      const descriptorData =
        response.messageResponse.value.fileDescriptorProto[0];
      if (!descriptorData) {
        throw new ReflectionError(Code.NotFound, `File not found: ${filename}`);
      }

      const fileDescriptorSet = create(FileDescriptorSetSchema, {
        file: response.messageResponse.value.fileDescriptorProto.map((data) =>
          fromBinary(FileDescriptorProtoSchema, data),
        ),
      });

      return fileDescriptorSet.file[0];
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the file descriptor for a file containing the specified symbol.
   *
   * @param symbol - Fully-qualified symbol name (e.g., "mypackage.MyService")
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the symbol is not found or request fails
   */
  async getFileContainingSymbol(symbol: string): Promise<FileDescriptorProto> {
    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "fileContainingSymbol",
        value: symbol,
      },
    });

    const response = await this.#sendRequest(request);

    if (response.messageResponse.case === "fileDescriptorResponse") {
      const descriptorData =
        response.messageResponse.value.fileDescriptorProto[0];
      if (!descriptorData) {
        throw new ReflectionError(
          Code.NotFound,
          `Symbol not found: ${symbol}`,
        );
      }

      const fileDescriptorSet = create(FileDescriptorSetSchema, {
        file: response.messageResponse.value.fileDescriptorProto.map((data) =>
          fromBinary(FileDescriptorProtoSchema, data),
        ),
      });

      return fileDescriptorSet.file[0];
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the file descriptor for a file containing an extension.
   *
   * @param containingType - Fully-qualified name of the message type being extended
   * @param extensionNumber - The extension field number
   * @returns The file descriptor proto
   * @throws {ReflectionError} If the extension is not found or request fails
   */
  async getFileContainingExtension(
    containingType: string,
    extensionNumber: number,
  ): Promise<FileDescriptorProto> {
    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "fileContainingExtension",
        value: {
          containingType,
          extensionNumber,
        },
      },
    });

    const response = await this.#sendRequest(request);

    if (response.messageResponse.case === "fileDescriptorResponse") {
      const descriptorData =
        response.messageResponse.value.fileDescriptorProto[0];
      if (!descriptorData) {
        throw new ReflectionError(
          Code.NotFound,
          `Extension not found: ${containingType}:${extensionNumber}`,
        );
      }

      const fileDescriptorSet = create(FileDescriptorSetSchema, {
        file: response.messageResponse.value.fileDescriptorProto.map((data) =>
          fromBinary(FileDescriptorProtoSchema, data),
        ),
      });

      return fileDescriptorSet.file[0];
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves all extension numbers for a given message type.
   *
   * @param type - Fully-qualified message type name
   * @returns Array of extension field numbers
   * @throws {ReflectionError} If the request fails
   */
  async getAllExtensionNumbersOfType(type: string): Promise<number[]> {
    const request = create(ServerReflectionRequestSchema, {
      messageRequest: {
        case: "allExtensionNumbersOfType",
        value: type,
      },
    });

    const response = await this.#sendRequest(request);

    if (response.messageResponse.case === "allExtensionNumbersResponse") {
      return response.messageResponse.value.extensionNumber;
    } else if (response.messageResponse.case === "errorResponse") {
      throw new ReflectionError(
        response.messageResponse.value.errorCode,
        response.messageResponse.value.errorMessage,
      );
    }

    throw new ReflectionError(Code.Internal, "Unexpected response type");
  }

  /**
   * Retrieves the service descriptor for a given service name.
   *
   * @param serviceName - Fully-qualified service name
   * @returns Service descriptor with methods and file information
   * @throws {ReflectionError} If the service is not found or request fails
   */
  async getServiceDescriptor(
    serviceName: string,
  ): Promise<ServiceDescriptor> {
    const file = await this.getFileContainingSymbol(serviceName);

    const service = file.service.find((s) => {
      const fullName = file.package ? `${file.package}.${s.name}` : s.name;
      return fullName === serviceName;
    });

    if (!service) {
      throw new ReflectionError(
        Code.NotFound,
        `Service not found in file: ${serviceName}`,
      );
    }

    const methods: MethodDescriptor[] = service.method.map((m) => ({
      name: m.name,
      fullName: `${serviceName}.${m.name}`,
      inputType: m.inputType.startsWith(".")
        ? m.inputType.slice(1)
        : m.inputType,
      outputType: m.outputType.startsWith(".")
        ? m.outputType.slice(1)
        : m.outputType,
      clientStreaming: m.clientStreaming,
      serverStreaming: m.serverStreaming,
    }));

    return {
      name: service.name,
      fullName: serviceName,
      methods,
      file,
    };
  }

  /**
   * Retrieves the method descriptor for a specific method.
   *
   * @param serviceName - Fully-qualified service name
   * @param methodName - Simple method name
   * @returns Method descriptor
   * @throws {ReflectionError} If the method is not found or request fails
   */
  async getMethodDescriptor(
    serviceName: string,
    methodName: string,
  ): Promise<MethodDescriptor> {
    const serviceDesc = await this.getServiceDescriptor(serviceName);
    const method = serviceDesc.methods.find((m) => m.name === methodName);

    if (!method) {
      throw new ReflectionError(
        Code.NotFound,
        `Method not found: ${serviceName}.${methodName}`,
      );
    }

    return method;
  }

  /**
   * Builds a complete FileRegistry containing all services.
   *
   * @returns FileRegistry with all discovered services
   * @throws {ReflectionError} If the request fails
   */
  async buildFileRegistry(): Promise<FileRegistry> {
    const services = await this.listServices();
    const fileMap = new Map<string, FileDescriptorProto>();

    // Helper to recursively collect file and its dependencies
    const collectFileDependencies = async (file: FileDescriptorProto) => {
      // Process dependencies first (depth-first to resolve in correct order)
      for (const depName of file.dependency) {
        if (!fileMap.has(depName)) {
          // Dependency not yet collected, fetch it
          const depFile = await this.getFileByFilename(depName);
          // Recursively collect the dependency's dependencies
          await collectFileDependencies(depFile);
        }
      }

      // Add this file after its dependencies are added
      if (file.name) {
        fileMap.set(file.name, file);
      }
    };

    // Collect files for all services
    for (const serviceName of services) {
      const request = create(ServerReflectionRequestSchema, {
        messageRequest: {
          case: "fileContainingSymbol",
          value: serviceName,
        },
      });

      const response = await this.#sendRequest(request);

      if (response.messageResponse.case === "fileDescriptorResponse") {
        // Process all files returned by the server
        for (const data of response.messageResponse.value.fileDescriptorProto) {
          const file = fromBinary(FileDescriptorProtoSchema, data);
          if (file.name && !fileMap.has(file.name)) {
            await collectFileDependencies(file);
          }
        }
      }
    }

    // Create file descriptor set
    const fileDescriptorSet = create(FileDescriptorSetSchema, {
      file: Array.from(fileMap.values()),
    });

    return createFileRegistry(fileDescriptorSet);
  }

  /**
   * Sends a reflection request and returns the response.
   * This is a low-level method used internally.
   *
   * @param request - The reflection request
   * @returns The reflection response
   * @throws {ReflectionError} If the request fails
   */
  async #sendRequest(
    request: ServerReflectionRequest,
  ): Promise<ServerReflectionResponse> {
    // For bidirectional streaming, we create an async generator that yields our request
    async function* input() {
      yield request;
    }

    // Call the streaming method with our input
    const responses = this.#client.serverReflectionInfo(input());

    // Get the first (and only) response
    for await (const response of responses) {
      return response;
    }

    throw new ReflectionError(Code.Internal, "No response received");
  }
}
