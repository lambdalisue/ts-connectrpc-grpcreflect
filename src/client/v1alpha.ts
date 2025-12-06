import type { Transport } from "@connectrpc/connect";

import { ServerReflection } from "../_gen/v1alpha/reflection_pb.js";

import { ServerReflectionClient as BaseServerReflectionClient } from "./v1.js";

export { ServerReflection } from "../_gen/v1alpha/reflection_pb.js";

/**
 * Client for gRPC Server Reflection Protocol (v1alpha).
 * Allows dynamic discovery of services and their definitions at runtime.
 *
 * This is a compatibility wrapper around the v1 client that uses the v1alpha
 * service definition. The v1alpha and v1 protocols are wire-compatible.
 */
export class ServerReflectionClient extends BaseServerReflectionClient {
  /**
   * Creates a new ServerReflectionClient for v1alpha protocol.
   *
   * @param transport - The ConnectRPC transport to use for communication
   */
  constructor(transport: Transport) {
    // v1alpha and v1 have identical wire format, so we can safely cast
    super(
      transport,
      ServerReflection as unknown as Parameters<
        typeof BaseServerReflectionClient
      >[1],
    );
  }
}
