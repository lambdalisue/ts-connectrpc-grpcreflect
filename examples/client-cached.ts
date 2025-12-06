/**
 * Using cached client to reduce network calls
 *
 * Start the test server first:
 *   docker compose up -d echo-connectrpc
 *
 * Then run this example:
 *   npx tsx examples/client-cached.ts
 */

import { CachedServerReflectionClient } from "../src/client/index.js";
import { createConnectTransport } from "@connectrpc/connect-node";

const port = process.env.PORT || "8080";

// Create transport (Connect protocol with HTTP/2)
const transport = createConnectTransport({
  baseUrl: `http://localhost:${port}`,
  httpVersion: "2",
});

// Create cached client
const client = new CachedServerReflectionClient(transport);

// First call - fetches from server
console.log("Fetching services (first call)...");
const services1 = await client.listServices();
const stats1 = client.getCacheStats();
console.log(`Stats: ${stats1.hits} hits, ${stats1.misses} misses`);

// Second call - uses cache
console.log("\nFetching services (second call)...");
const services2 = await client.listServices();
const stats2 = client.getCacheStats();
console.log(`Stats: ${stats2.hits} hits, ${stats2.misses} misses`);

// Fetch service descriptors
console.log("\nFetching service descriptors...");
for (const serviceName of services1.slice(0, 3)) {
  await client.getServiceDescriptor(serviceName);
}

const stats3 = client.getCacheStats();
console.log(`Final stats: ${stats3.hits} hits, ${stats3.misses} misses`);
console.log(
  `Cache entries: ${stats3.fileEntries} files, ${stats3.serviceEntries} services`,
);

// Clear cache when needed
client.clearCache();
console.log("\nCache cleared!");

process.exit(0);
