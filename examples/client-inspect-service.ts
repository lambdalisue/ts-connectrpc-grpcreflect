/**
 * Inspect a service and display its methods using reflection client
 *
 * Start the test server first:
 *   docker compose up -d echo-connectrpc
 *
 * Then run this example:
 *   npx tsx examples/client-inspect-service.ts [serviceName]
 */

import {
  createServerReflectionClient,
  formatServiceDescriptor,
} from "../src/client/index.js";
import { createConnectTransport } from "@connectrpc/connect-node";

const port = process.env.PORT || "8080";

// Create transport
const transport = createConnectTransport({
  baseUrl: `http://localhost:${port}`,
  httpVersion: "2",
});

// Create reflection client
const client = createServerReflectionClient(transport);

// Get service to inspect
const serviceName = process.argv[2] || "echo.v1.Echo";

// Get service descriptor
const service = await client.getServiceDescriptor(serviceName);

// Display formatted output
console.log(formatServiceDescriptor(service));

// Or access data programmatically
console.log(`\nService has ${service.methods.length} method(s)`);
for (const method of service.methods) {
  console.log(`  - ${method.name}`);
  console.log(`    Input: ${method.inputType}`);
  console.log(`    Output: ${method.outputType}`);
  console.log(
    `    Streaming: ${method.clientStreaming ? "client " : ""}${method.serverStreaming ? "server" : ""}`,
  );
}

process.exit(0);
