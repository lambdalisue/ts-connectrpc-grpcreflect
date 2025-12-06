/**
 * Dynamically call gRPC methods using reflection
 *
 * Start the test server first:
 *   docker compose up -d echo-connectrpc
 *
 * Then run this example:
 *   npx tsx examples/client-call-method.ts
 *
 * This example demonstrates how to:
 * 1. Discover services using reflection
 * 2. Build a FileRegistry with all type information
 * 3. Dynamically create a client without generated code
 * 4. Call methods with dynamically created messages
 */

import { createServerReflectionClient } from "../src/client/index.js";
import { createConnectTransport } from "@connectrpc/connect-node";
import { createClient, type Client } from "@connectrpc/connect";
import { create, type DescService } from "@bufbuild/protobuf";

const port = process.env.PORT || "8080";

// Create transport
const transport = createConnectTransport({
  baseUrl: `http://localhost:${port}`,
  httpVersion: "2",
});

// Create reflection client
const reflectionClient = createServerReflectionClient(transport);

// Step 1: Discover available services
console.log("Discovering services...");
const services = await reflectionClient.listServices();
console.log(`Found ${services.length} services`);

// Step 2: Build FileRegistry with all type information
console.log("\nBuilding file registry...");
const registry = await reflectionClient.buildFileRegistry();

// Step 3: Select a service to call (example: grpc.reflection.v1.ServerReflection)
// Note: Using reflection service itself as it has no external dependencies
const serviceName = "grpc.reflection.v1.ServerReflection";
console.log(`\nUsing service: ${serviceName}`);

// Get service descriptor from registry
const serviceDesc = registry.getService(serviceName);
if (!serviceDesc) {
  throw new Error(`Service not found: ${serviceName}`);
}

// Step 4: Create a dynamic client using the service descriptor
const client: Client<DescService> = createClient(serviceDesc, transport);

// Step 5: Get method info
const method = serviceDesc.methods[0];
if (!method) {
  throw new Error("No methods found in service");
}

console.log(`\nMethod info: ${method.name}`);
console.log(`  Input type: ${method.input.typeName}`);
console.log(`  Output type: ${method.output.typeName}`);
console.log(
  `  Streaming: client=${method.methodKind === "bidi_streaming" || method.methodKind === "client_streaming"}, server=${method.methodKind === "bidi_streaming" || method.methodKind === "server_streaming"}`,
);

// Get input message type from registry
const inputMessageDesc = registry.getMessage(method.input.typeName);
if (!inputMessageDesc) {
  throw new Error(`Input message type not found: ${method.input.typeName}`);
}

console.log("\nRequest message fields:");
for (const field of inputMessageDesc.fields) {
  console.log(`  - ${field.name} (${field.fieldKind})`);
}

// Step 6: Actually call the method!
// ServerReflectionInfo is a bidirectional streaming method
// We'll send a list_services request and receive the response
console.log("\n--- Calling method dynamically ---");

// For protobuf-es, oneof fields need to be specified with { case, value } structure
// Create a request to list services using the correct oneof format
const request = create(inputMessageDesc, {
  // oneof messageRequest requires { case: "listServices", value: "" }
  messageRequest: {
    case: "listServices",
    value: "", // Empty string means list all services
  },
});

console.log('Sending request: { messageRequest: { case: "listServices", value: "" } }');

// Call the bidirectional streaming method
// For ServerReflectionInfo, we need to use async iteration
const methodFn = (client as Record<string, unknown>)[
  method.localName
] as CallableFunction;

if (method.methodKind === "bidi_streaming") {
  // For bidi streaming, we need to provide an async generator
  async function* generateRequests() {
    yield request;
  }

  const responseStream = methodFn(generateRequests());

  console.log("\nResponse:");
  for await (const response of responseStream as AsyncIterable<unknown>) {
    // Response structure: { messageResponse: { case: "listServicesResponse", value: { service: [...] } } }
    const resp = response as {
      messageResponse?: {
        case?: string;
        value?: { service?: Array<{ name?: string }> };
      };
    };

    if (resp.messageResponse?.case === "listServicesResponse") {
      const serviceList = resp.messageResponse.value?.service;
      if (serviceList) {
        console.log("  Services from dynamic call:");
        for (const svc of serviceList) {
          console.log(`    - ${svc.name}`);
        }
      }
    } else {
      console.log(`  Response case: ${resp.messageResponse?.case}`);
      console.log(`  Raw response: ${JSON.stringify(response)}`);
    }
    break; // Only need one response for this demo
  }
} else {
  console.log(
    `  Method kind '${method.methodKind}' - skipping actual call in this demo`,
  );
}

console.log("\n--- Dynamic method call complete ---");

process.exit(0);
