import type { ConnectRouter } from "@connectrpc/connect";
import type { FileDescriptorSet } from "@bufbuild/protobuf/wkt";

import { readFileSync } from "node:fs";

import { fromBinary } from "@bufbuild/protobuf";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";

import * as v1 from "./v1.js";
import * as v1alpha from "./v1alpha.js";

/**
 * Registers gRPC server reflection services (v1 and v1alpha) with the Connect router
 * using a FileDescriptorSet.
 *
 * @param router - The Connect router to register the reflection services with
 * @param fileDescriptorSet - The FileDescriptorSet containing the service definitions
 */
export function registerServerReflectionFromFileDescriptorSet(
  router: ConnectRouter,
  fileDescriptorSet: FileDescriptorSet,
): void {
  const serverReflectionV1 =
    v1.ServerReflectionImpl.fromFileDescriptorSet(fileDescriptorSet);
  const serverReflectionV1alpha =
    v1alpha.ServerReflectionImpl.fromFileDescriptorSet(fileDescriptorSet);

  router.service(v1.ServerReflection, serverReflectionV1);
  router.service(v1alpha.ServerReflection, serverReflectionV1alpha);
}

/**
 * Registers gRPC server reflection services (v1 and v1alpha) with the Connect router
 * using a binary-encoded FileDescriptorSet.
 *
 * @param router - The Connect router to register the reflection services with
 * @param data - The binary-encoded FileDescriptorSet data
 */
export function registerServerReflectionFromUint8Array(
  router: ConnectRouter,
  data: Uint8Array,
): void {
  const fileDescriptorSet = fromBinary(FileDescriptorSetSchema, data);
  registerServerReflectionFromFileDescriptorSet(router, fileDescriptorSet);
}

/**
 * Registers gRPC server reflection services (v1 and v1alpha) with the Connect router
 * by reading a FileDescriptorSet from a file.
 *
 * @param router - The Connect router to register the reflection services with
 * @param path - The file path to the binary-encoded FileDescriptorSet
 */
export function registerServerReflectionFromFile(
  router: ConnectRouter,
  path: string,
): void {
  const data = readFileSync(path);
  registerServerReflectionFromUint8Array(router, data);
}

export { v1, v1alpha };
