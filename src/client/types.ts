import type { Code } from "@connectrpc/connect";
import type { FileDescriptorProto } from "@bufbuild/protobuf/wkt";

/**
 * Descriptor for a gRPC service containing metadata about the service and its methods.
 */
export interface ServiceDescriptor {
  /**
   * The simple name of the service (without package prefix).
   */
  name: string;

  /**
   * The fully qualified name of the service (e.g., "grpc.reflection.v1.ServerReflection").
   */
  fullName: string;

  /**
   * Array of method descriptors for all methods in this service.
   */
  methods: MethodDescriptor[];

  /**
   * The file descriptor proto containing this service definition.
   */
  file: FileDescriptorProto;
}

/**
 * Descriptor for a gRPC method containing metadata about the method.
 */
export interface MethodDescriptor {
  /**
   * The simple name of the method (e.g., "ServerReflectionInfo").
   */
  name: string;

  /**
   * The fully qualified name of the method (e.g., "grpc.reflection.v1.ServerReflection.ServerReflectionInfo").
   */
  fullName: string;

  /**
   * The fully qualified name of the input message type.
   */
  inputType: string;

  /**
   * The fully qualified name of the output message type.
   */
  outputType: string;

  /**
   * Whether this method uses client streaming.
   */
  clientStreaming: boolean;

  /**
   * Whether this method uses server streaming.
   */
  serverStreaming: boolean;
}

/**
 * Error thrown by reflection client operations.
 */
export class ReflectionError extends Error {
  /**
   * The gRPC error code.
   */
  code: Code;

  /**
   * The original error message from the server.
   */
  originalMessage: string;

  /**
   * Creates a new ReflectionError.
   *
   * @param code - The gRPC error code
   * @param message - The error message
   */
  constructor(code: Code, message: string) {
    super(message);
    this.name = "ReflectionError";
    this.code = code;
    this.originalMessage = message;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReflectionError);
    }
  }
}
