/**
 * Dynamically call gRPC methods using the simplified API
 *
 * Start the test server first:
 *   docker compose up -d echo-connectrpc
 *
 * Then run this example:
 *   npx tsx examples/client-dynamic-call.ts
 *
 * This example demonstrates the simplified dynamic method calling API:
 * - client.call() for unary methods
 * - client.serverStream() for server streaming methods
 * - client.clientStream() for client streaming methods
 * - client.bidiStream() for bidirectional streaming methods
 * - client.service() for Proxy-based method access
 */

import { createServerReflectionClient } from "../src/client/index.js";
import { createConnectTransport } from "@connectrpc/connect-node";

const port = process.env.PORT || "8080";

// Create transport
const transport = createConnectTransport({
  baseUrl: `http://localhost:${port}`,
  httpVersion: "2",
});

// Create reflection client
const client = createServerReflectionClient(transport);

// List available services
console.log("=== List Services ===");
const services = await client.listServices();
console.log("Available services:");
for (const service of services) {
  console.log(`  - ${service}`);
}

// ============================================================
// Method 1: Using full path with bidiStream()
// ============================================================
console.log("\n=== Method 1: Using bidiStream() ===");

async function* listServicesRequest() {
  yield {
    messageRequest: {
      case: "listServices",
      value: "",
    },
  };
}

const responses = client.bidiStream(
  "grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
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
    console.log("Services from bidiStream:");
    for (const svc of resp.messageResponse.value?.service ?? []) {
      console.log(`  - ${svc.name}`);
    }
  }
  break; // Only need first response
}

// ============================================================
// Method 2: Using Proxy-based service client
// ============================================================
console.log("\n=== Method 2: Using Proxy-based service() ===");

const reflection = client.service("grpc.reflection.v1.ServerReflection");

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
    console.log("Services from service() proxy:");
    for (const svc of resp.messageResponse.value?.service ?? []) {
      console.log(`  - ${svc.name}`);
    }
  }
  break; // Only need first response
}

console.log("\n=== Done ===");
process.exit(0);
