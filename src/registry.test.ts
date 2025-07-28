import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, it, expect, beforeEach } from "vitest";
import { createFileRegistry, fromBinary } from "@bufbuild/protobuf";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";

import {
  getFileByFilename,
  getFileContainingSymbol,
  getFileContainingExtension,
  getAllExtensionNumbersOfType,
  getListServices,
} from "./registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("registry", () => {
  let registry: ReturnType<typeof createFileRegistry>;

  beforeEach(() => {
    // Load the file descriptor set from the generated binary file
    const data = readFileSync(join(__dirname, "_gen/file_descriptor.binpb"));
    const fileDescriptorSet = fromBinary(FileDescriptorSetSchema, data);
    registry = createFileRegistry(fileDescriptorSet);
  });

  describe("getFileByFilename", () => {
    it("should return file descriptor for existing file", () => {
      const result = getFileByFilename(registry, "v1/reflection.proto");
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it("should return undefined for non-existing file", () => {
      const result = getFileByFilename(registry, "non-existing.proto");
      expect(result).toBeUndefined();
    });
  });

  describe("getFileContainingSymbol", () => {
    it("should return file descriptor for existing service symbol", () => {
      const result = getFileContainingSymbol(
        registry,
        "grpc.reflection.v1.ServerReflection",
      );
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it("should return file descriptor for existing message symbol", () => {
      const result = getFileContainingSymbol(
        registry,
        "grpc.reflection.v1.ServerReflectionRequest",
      );
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it("should return undefined for non-existing symbol", () => {
      const result = getFileContainingSymbol(registry, "non.existing.Symbol");
      expect(result).toBeUndefined();
    });
  });

  describe("getFileContainingExtension", () => {
    it("should return undefined when message type doesn't exist", () => {
      const result = getFileContainingExtension(
        registry,
        "non.existing.Type",
        1,
      );
      expect(result).toBeUndefined();
    });

    it("should return undefined when extension doesn't exist", () => {
      const result = getFileContainingExtension(
        registry,
        "grpc.reflection.v1.ServerReflectionRequest",
        999999,
      );
      expect(result).toBeUndefined();
    });
  });

  describe("getAllExtensionNumbersOfType", () => {
    it("should return empty array for type without extensions", () => {
      const result = getAllExtensionNumbersOfType(
        registry,
        "grpc.reflection.v1.ServerReflectionRequest",
      );
      expect(result).toEqual([]);
    });

    it("should return empty array for non-existing type", () => {
      const result = getAllExtensionNumbersOfType(
        registry,
        "non.existing.Type",
      );
      expect(result).toEqual([]);
    });
  });

  describe("getListServices", () => {
    it("should return list of all services", () => {
      const result = getListServices(registry, "");
      expect(result).toContain("grpc.reflection.v1.ServerReflection");
      expect(result).toContain("grpc.reflection.v1alpha.ServerReflection");
    });

    it("should ignore the value parameter", () => {
      const result1 = getListServices(registry, "");
      const result2 = getListServices(registry, "any value");
      expect(result1).toEqual(result2);
    });
  });
});
