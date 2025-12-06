/**
 * Dynamically call gRPC methods using the DynamicDispatchClient and ProxyDispatchClient
 *
 * Start the test server first:
 *   docker compose up -d echo-connectrpc
 *
 * Then run this example:
 *   npx tsx examples/client-dynamic-call.ts
 *
 * This example demonstrates the dynamic method calling API:
 * - DynamicDispatchClient for explicit service/method name calls
 * - ProxyDispatchClient for Proxy-based method access
 */

import {
  ServerReflectionClient,
  DynamicDispatchClient,
  ProxyDispatchClient,
} from "../src/client/index.js";
import {
  createGrpcTransport,
  Http2SessionManager,
} from "@connectrpc/connect-node";

const port = process.env.PORT || "8080";
const baseUrl = `http://localhost:${port}`;

// Create session manager for HTTP/2 connection lifecycle control
const sessionManager = new Http2SessionManager(baseUrl);

// Create transport (gRPC protocol always uses HTTP/2)
const transport = createGrpcTransport({
  baseUrl,
  httpVersion: "2",
  sessionManager,
});

try {
  // Step 1: Use reflection to discover services and build registry
  console.log("=== List Services ===");
  let registry;
  {
    await using reflectionClient = new ServerReflectionClient(transport);
    const services = await reflectionClient.listServices();
    console.log("Available services:");
    for (const service of services) {
      console.log(`  - ${service}`);
    }
    registry = await reflectionClient.buildFileRegistry();
  }
  // Reflection client is now disposed

  // ============================================================
  // Method 1: Using DynamicDispatchClient with bidiStream()
  // ============================================================
  console.log("\n=== Method 1: Using DynamicDispatchClient.bidiStream() ===");

  const client = new DynamicDispatchClient(transport, registry);

  async function* listServicesRequest() {
    yield {
      messageRequest: {
        case: "listServices",
        value: "",
      },
    };
  }

  const responses = client.bidiStream(
    "grpc.reflection.v1.ServerReflection",
    "ServerReflectionInfo",
    listServicesRequest(),
  );

  for await (const response of responses) {
    const resp = response as {
      messageResponse?: {
        case?: string;
        value?: { service?: Array<{ name?: string }> };
      };
    };

    if (resp.messageResponse?.case === "listServicesResponse") {
      console.log("Services from DynamicDispatchClient.bidiStream:");
      for (const svc of resp.messageResponse.value?.service ?? []) {
        console.log(`  - ${svc.name}`);
      }
    }
    break; // Only need first response
  }

  // ============================================================
  // Method 2: Using ProxyDispatchClient
  // ============================================================
  console.log("\n=== Method 2: Using ProxyDispatchClient ===");

  const reflection = new ProxyDispatchClient(
    transport,
    registry,
    "grpc.reflection.v1.ServerReflection",
  );

  async function* proxyRequest() {
    yield {
      messageRequest: {
        case: "listServices",
        value: "",
      },
    };
  }

  // Call method directly by name (camelCase)
  const proxyResponses = reflection.serverReflectionInfo(proxyRequest());

  for await (const response of proxyResponses as AsyncIterable<unknown>) {
    const resp = response as {
      messageResponse?: {
        case?: string;
        value?: { service?: Array<{ name?: string }> };
      };
    };

    if (resp.messageResponse?.case === "listServicesResponse") {
      console.log("Services from ProxyDispatchClient:");
      for (const svc of resp.messageResponse.value?.service ?? []) {
        console.log(`  - ${svc.name}`);
      }
    }
    break; // Only need first response
  }

  console.log("\n=== Done ===");
} finally {
  // Close HTTP/2 connection
  sessionManager.abort();
}
