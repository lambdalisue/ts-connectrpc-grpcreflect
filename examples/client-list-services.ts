/**
 * List all services from a gRPC server using reflection client
 *
 * Start the test server first:
 *   docker compose up -d echo-connectrpc
 *
 * Then run this example:
 *   npx tsx examples/client-list-services.ts
 */

import { createServerReflectionClient } from "../src/client/index.js";
import { createConnectTransport } from "@connectrpc/connect-node";

const port = process.env.PORT || "8080";

// Create transport (Connect protocol with HTTP/2 for bidirectional streaming)
const transport = createConnectTransport({
  baseUrl: `http://localhost:${port}`,
  httpVersion: "2",
});

// Create reflection client
const client = createServerReflectionClient(transport);

// List all services
const services = await client.listServices();

console.log("Available services:");
services.forEach((service, i) => {
  console.log(`  ${i + 1}. ${service}`);
});

process.exit(0);
