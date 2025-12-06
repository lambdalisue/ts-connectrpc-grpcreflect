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
  ServerReflectionClient,
  formatServiceDescriptor,
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
  // Create reflection client with automatic disposal
  await using client = new ServerReflectionClient(transport);

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
} finally {
  // Close HTTP/2 connection
  sessionManager.abort();
}
