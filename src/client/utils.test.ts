import type { ServiceDescriptor, MethodDescriptor } from "./types.js";
import { describe, it, expect } from "vitest";
import { create } from "@bufbuild/protobuf";
import { FileDescriptorProtoSchema } from "@bufbuild/protobuf/wkt";

import {
  formatServiceList,
  formatServiceDescriptor,
  formatMethodDescriptor,
} from "./utils.js";

describe("utils", () => {
  describe("formatServiceList", () => {
    it("should format empty service list", () => {
      const result = formatServiceList([]);
      expect(result).toBe("No services available");
    });

    it("should format single service", () => {
      const result = formatServiceList(["example.v1.UserService"]);
      expect(result).toBe("1. example.v1.UserService");
    });

    it("should format multiple services", () => {
      const result = formatServiceList([
        "example.v1.UserService",
        "example.v1.ProductService",
        "example.v1.OrderService",
      ]);

      expect(result).toContain("1. example.v1.UserService");
      expect(result).toContain("2. example.v1.ProductService");
      expect(result).toContain("3. example.v1.OrderService");
    });
  });

  describe("formatServiceDescriptor", () => {
    it("should format service with no methods", () => {
      const service: ServiceDescriptor = {
        name: "EmptyService",
        fullName: "example.v1.EmptyService",
        methods: [],
        file: create(FileDescriptorProtoSchema, {
          name: "example/v1/empty.proto",
        }),
      };

      const result = formatServiceDescriptor(service);
      expect(result).toContain("Service: example.v1.EmptyService");
      expect(result).toContain("Methods (0):");
    });

    it("should format service with unary method", () => {
      const service: ServiceDescriptor = {
        name: "UserService",
        fullName: "example.v1.UserService",
        methods: [
          {
            name: "GetUser",
            fullName: "example.v1.UserService.GetUser",
            inputType: "example.v1.GetUserRequest",
            outputType: "example.v1.GetUserResponse",
            clientStreaming: false,
            serverStreaming: false,
          },
        ],
        file: create(FileDescriptorProtoSchema, {
          name: "example/v1/user.proto",
        }),
      };

      const result = formatServiceDescriptor(service);
      expect(result).toContain("Service: example.v1.UserService");
      expect(result).toContain("GetUser (unary)");
      expect(result).toContain("→ example.v1.GetUserRequest");
      expect(result).toContain("← example.v1.GetUserResponse");
    });

    it("should format service with streaming methods", () => {
      const service: ServiceDescriptor = {
        name: "StreamService",
        fullName: "example.v1.StreamService",
        methods: [
          {
            name: "ClientStream",
            fullName: "example.v1.StreamService.ClientStream",
            inputType: "example.v1.Request",
            outputType: "example.v1.Response",
            clientStreaming: true,
            serverStreaming: false,
          },
          {
            name: "ServerStream",
            fullName: "example.v1.StreamService.ServerStream",
            inputType: "example.v1.Request",
            outputType: "example.v1.Response",
            clientStreaming: false,
            serverStreaming: true,
          },
          {
            name: "BidiStream",
            fullName: "example.v1.StreamService.BidiStream",
            inputType: "example.v1.Request",
            outputType: "example.v1.Response",
            clientStreaming: true,
            serverStreaming: true,
          },
        ],
        file: create(FileDescriptorProtoSchema, {
          name: "example/v1/stream.proto",
        }),
      };

      const result = formatServiceDescriptor(service);
      expect(result).toContain("ClientStream (client stream)");
      expect(result).toContain("ServerStream (server stream)");
      expect(result).toContain("BidiStream (bidi stream)");
    });
  });

  describe("formatMethodDescriptor", () => {
    it("should format unary method", () => {
      const method: MethodDescriptor = {
        name: "GetUser",
        fullName: "example.v1.UserService.GetUser",
        inputType: "example.v1.GetUserRequest",
        outputType: "example.v1.GetUserResponse",
        clientStreaming: false,
        serverStreaming: false,
      };

      const result = formatMethodDescriptor(method);
      expect(result).toContain("example.v1.UserService.GetUser (unary)");
      expect(result).toContain("→ example.v1.GetUserRequest");
      expect(result).toContain("← example.v1.GetUserResponse");
    });

    it("should format client streaming method", () => {
      const method: MethodDescriptor = {
        name: "Upload",
        fullName: "example.v1.FileService.Upload",
        inputType: "example.v1.UploadRequest",
        outputType: "example.v1.UploadResponse",
        clientStreaming: true,
        serverStreaming: false,
      };

      const result = formatMethodDescriptor(method);
      expect(result).toContain("example.v1.FileService.Upload (client stream)");
    });

    it("should format server streaming method", () => {
      const method: MethodDescriptor = {
        name: "ListUsers",
        fullName: "example.v1.UserService.ListUsers",
        inputType: "example.v1.ListUsersRequest",
        outputType: "example.v1.User",
        clientStreaming: false,
        serverStreaming: true,
      };

      const result = formatMethodDescriptor(method);
      expect(result).toContain("example.v1.UserService.ListUsers (server stream)");
    });

    it("should format bidirectional streaming method", () => {
      const method: MethodDescriptor = {
        name: "Chat",
        fullName: "example.v1.ChatService.Chat",
        inputType: "example.v1.ChatMessage",
        outputType: "example.v1.ChatMessage",
        clientStreaming: true,
        serverStreaming: true,
      };

      const result = formatMethodDescriptor(method);
      expect(result).toContain("example.v1.ChatService.Chat (bidi stream)");
    });
  });
});
