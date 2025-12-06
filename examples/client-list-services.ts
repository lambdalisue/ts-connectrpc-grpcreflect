/**
 * List all services from a gRPC server using reflection client
 *
 * Start the test server first:
 *   docker compose up -d echo-connectrpc
 *
 * Then run this example:
 *   npx tsx examples/client-list-services.ts
 */

import { ServerReflectionClient } from "../src/client/index.js";
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
  // Create reflection client with automatic disposal
  await using client = new ServerReflectionClient(transport);

  // List all services
  const services = await client.listServices();

  console.log("Available services:");
  services.forEach((service, i) => {
    console.log(`  ${i + 1}. ${service}`);
  });
} finally {
  // Close HTTP/2 connection
  sessionManager.abort();
}
