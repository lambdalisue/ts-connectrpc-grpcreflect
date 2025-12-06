/**
 * Basic server example with reflection enabled
 *
 * Run this server:
 *   npx tsx examples/server-basic.ts
 *
 * Then test with the client examples:
 *   npx tsx examples/client-list-services.ts
 */

import * as http2 from "node:http2";
import type { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { registerServerReflectionFromFile } from "../src/server/index.js";

const routes = (router: ConnectRouter) => {
  // Register your services here
  // router.service(MyService, myServiceImpl);

  // Add reflection support using the generated file descriptor
  registerServerReflectionFromFile(router, "./src/_gen/file_descriptor.binpb");
};

// Use HTTP/2 (required for bidirectional streaming)
const handler = connectNodeAdapter({
  routes,
});

const server = http2.createServer(handler);

const PORT = Number(process.env.PORT) || 8090;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop");
  console.log("\nYou can now use grpcurl or the client examples:");
  console.log("  grpcurl -plaintext localhost:8090 list");
  console.log("  npx tsx examples/client-list-services.ts");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  server.close(() => {
    console.log("Server stopped");
    process.exit(0);
  });
});
