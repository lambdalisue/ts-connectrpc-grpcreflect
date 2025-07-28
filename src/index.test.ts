import type { ConnectRouter } from "@connectrpc/connect";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fromBinary } from "@bufbuild/protobuf";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  registerServerReflectionFromFileDescriptorSet,
  registerServerReflectionFromUint8Array,
  registerServerReflectionFromFile,
  v1,
  v1alpha,
} from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("index", () => {
  let mockRouter: ConnectRouter;
  let fileDescriptorData: Uint8Array;

  beforeEach(() => {
    // Create a mock router with a service method
    mockRouter = {
      service: vi.fn(),
    } as unknown as ConnectRouter;

    // Load test file descriptor data
    fileDescriptorData = readFileSync(
      join(__dirname, "_gen/file_descriptor.binpb"),
    );
  });

  describe("registerServerReflectionFromFileDescriptorSet", () => {
    it("should register both v1 and v1alpha services", () => {
      const fileDescriptorSet = fromBinary(
        FileDescriptorSetSchema,
        fileDescriptorData,
      );

      registerServerReflectionFromFileDescriptorSet(
        mockRouter,
        fileDescriptorSet,
      );

      expect(mockRouter.service).toHaveBeenCalledTimes(2);

      // Check that v1 service was registered
      expect(mockRouter.service).toHaveBeenCalledWith(
        v1.ServerReflection,
        expect.any(v1.ServerReflectionImpl),
      );

      // Check that v1alpha service was registered
      expect(mockRouter.service).toHaveBeenCalledWith(
        v1alpha.ServerReflection,
        expect.any(v1alpha.ServerReflectionImpl),
      );
    });

    it("should create ServerReflectionImpl instances with the same registry", () => {
      const fileDescriptorSet = fromBinary(
        FileDescriptorSetSchema,
        fileDescriptorData,
      );

      registerServerReflectionFromFileDescriptorSet(
        mockRouter,
        fileDescriptorSet,
      );

      const mockService = vi.mocked(mockRouter.service);
      const v1Instance = mockService.mock.calls[0][1];
      const v1alphaInstance = mockService.mock.calls[1][1];

      expect(v1Instance).toBeInstanceOf(v1.ServerReflectionImpl);
      expect(v1alphaInstance).toBeInstanceOf(v1alpha.ServerReflectionImpl);
    });
  });

  describe("registerServerReflectionFromUint8Array", () => {
    it("should register both v1 and v1alpha services from binary data", () => {
      registerServerReflectionFromUint8Array(mockRouter, fileDescriptorData);

      expect(mockRouter.service).toHaveBeenCalledTimes(2);

      // Check that v1 service was registered
      expect(mockRouter.service).toHaveBeenCalledWith(
        v1.ServerReflection,
        expect.any(v1.ServerReflectionImpl),
      );

      // Check that v1alpha service was registered
      expect(mockRouter.service).toHaveBeenCalledWith(
        v1alpha.ServerReflection,
        expect.any(v1alpha.ServerReflectionImpl),
      );
    });

    it("should handle invalid binary data gracefully", () => {
      const invalidData = new Uint8Array([1, 2, 3, 4]); // Invalid protobuf data

      expect(() => {
        registerServerReflectionFromUint8Array(mockRouter, invalidData);
      }).toThrow();
    });
  });

  describe("registerServerReflectionFromFile", () => {
    it("should register both v1 and v1alpha services from file", () => {
      const filePath = join(__dirname, "_gen/file_descriptor.binpb");

      registerServerReflectionFromFile(mockRouter, filePath);

      expect(mockRouter.service).toHaveBeenCalledTimes(2);

      // Check that v1 service was registered
      expect(mockRouter.service).toHaveBeenCalledWith(
        v1.ServerReflection,
        expect.any(v1.ServerReflectionImpl),
      );

      // Check that v1alpha service was registered
      expect(mockRouter.service).toHaveBeenCalledWith(
        v1alpha.ServerReflection,
        expect.any(v1alpha.ServerReflectionImpl),
      );
    });

    it("should throw error for non-existent file", () => {
      const invalidPath = "/non/existent/file.binpb";

      expect(() => {
        registerServerReflectionFromFile(mockRouter, invalidPath);
      }).toThrow();
    });
  });

  describe("exports", () => {
    it("should export v1 module", () => {
      expect(v1).toBeDefined();
      expect(v1.ServerReflection).toBeDefined();
      expect(v1.ServerReflectionImpl).toBeDefined();
    });

    it("should export v1alpha module", () => {
      expect(v1alpha).toBeDefined();
      expect(v1alpha.ServerReflection).toBeDefined();
      expect(v1alpha.ServerReflectionImpl).toBeDefined();
    });
  });
});
