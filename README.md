# @lambdalisue/connectrpc-grpcreflect

[![Unit Test](https://github.com/lambdalisue/ts-connectrpc-grpcreflect/actions/workflows/unit-test.yml/badge.svg)](https://github.com/lambdalisue/ts-connectrpc-grpcreflect/actions/workflows/unit-test.yml)

gRPC Server Reflection Protocol implementation for [ConnectRPC](https://connectrpc.com/) in ECMAScript/TypeScript.

Provides both **server** and **client** implementations for dynamic service discovery and inspection.

## Overview

This library enables:

- **Server**: Expose service definitions at runtime for tools like `grpcurl` and `grpc_cli`
- **Client**: Dynamically discover and inspect gRPC services without .proto files

### Requirements

> [!IMPORTANT]
> **HTTP/2 Required**: The [gRPC Reflection protocol specification](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md) mandates bidirectional streaming for request consistency in reverse proxy environments. When using Connect protocol, this requires HTTP/2.
>
> - Use `httpVersion: "2"` with `createConnectTransport`
> - Or use `createGrpcTransport` which always uses HTTP/2

- **ConnectRPC**: `@connectrpc/connect` v2.1+ and `@connectrpc/connect-node` v2.1+
- **Protobuf**: `@bufbuild/protobuf` v2.7+

## Installation

```bash
npm install @lambdalisue/connectrpc-grpcreflect
```

## Server Usage

Register reflection services on your ConnectRPC server to enable dynamic service discovery.

### Basic Server Setup

```typescript
import { createConnectRouter } from "@connectrpc/connect";
import { registerServerReflectionFromFileDescriptorSet } from "@lambdalisue/connectrpc-grpcreflect/server";
import { fileDescriptorSet } from "./generated/descriptor_pb.js";

const router = createConnectRouter();
// ... register your services

// Add reflection support
registerServerReflectionFromFileDescriptorSet(router, fileDescriptorSet);
```

### From Binary File

```typescript
import { registerServerReflectionFromFile } from "@lambdalisue/connectrpc-grpcreflect/server";

// Load FileDescriptorSet from a binary file
registerServerReflectionFromFile(router, "./path/to/descriptor.binpb");
```

### From Uint8Array

```typescript
import { registerServerReflectionFromUint8Array } from "@lambdalisue/connectrpc-grpcreflect/server";

const binaryData = await fetch("/api/descriptor").then((res) =>
  res.arrayBuffer(),
);
registerServerReflectionFromUint8Array(router, new Uint8Array(binaryData));
```

### Using with Tools

Once registered, tools like `grpcurl` can discover and interact with your services:

```bash
# List services
grpcurl -plaintext localhost:8080 list

# Describe a service
grpcurl -plaintext localhost:8080 describe mypackage.MyService

# Call a method
grpcurl -plaintext -d '{"name": "World"}' localhost:8080 mypackage.MyService/SayHello
```

## Client Usage

Use the reflection client to dynamically discover services and their definitions.

> [!IMPORTANT]
> The [gRPC Reflection protocol](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md) is designed with bidirectional streaming to ensure request consistency in reverse proxy environments. When using Connect protocol, this requires HTTP/2. Use `httpVersion: "2"` in your transport configuration, or use `createGrpcTransport` which always uses HTTP/2.

### Basic Client Setup

**Option 1: Using gRPC Protocol**

```typescript
import { createServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";
import { createGrpcTransport } from "@connectrpc/connect-node";

// gRPC transport always uses HTTP/2 (no httpVersion option needed)
const transport = createGrpcTransport({
  baseUrl: "https://api.example.com",
});

// Create client
const client = createServerReflectionClient(transport);

// List all services
const services = await client.listServices();
console.log("Available services:", services);

// Get service details
const serviceDesc = await client.getServiceDescriptor("mypackage.MyService");
console.log(
  "Methods:",
  serviceDesc.methods.map((m) => m.name),
);
```

**Option 2: Using Connect Protocol**

```typescript
import { createConnectTransport } from "@connectrpc/connect-node";

// Connect protocol requires explicit HTTP/2 for bidirectional streaming
const transport = createConnectTransport({
  baseUrl: "https://api.example.com",
  httpVersion: "2", // Required for bidirectional streaming
});
```

### Exploring Services

```typescript
import { createServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";

const client = createServerReflectionClient(transport);

// Get all services
const services = await client.listServices();

// Inspect each service
for (const serviceName of services) {
  const service = await client.getServiceDescriptor(serviceName);
  console.log(`\n${service.fullName}:`);

  for (const method of service.methods) {
    const type =
      method.clientStreaming && method.serverStreaming
        ? "bidi stream"
        : method.clientStreaming
          ? "client stream"
          : method.serverStreaming
            ? "server stream"
            : "unary";

    console.log(`  ${method.name} (${type})`);
    console.log(`    → ${method.inputType}`);
    console.log(`    ← ${method.outputType}`);
  }
}
```

### Building FileRegistry

```typescript
import { createServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";

const client = createServerReflectionClient(transport);

// Build complete registry from all services
const registry = await client.buildFileRegistry();

// Use registry for dynamic message creation
const serviceDesc = registry.getService("mypackage.MyService");
const messageDesc = registry.getMessage("mypackage.MyRequest");
```

### Calling Methods Dynamically (Simplified API)

The `ServerReflectionClient` provides a simplified API for calling methods without manually building registries:

```typescript
import { createServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";
import { createConnectTransport } from "@connectrpc/connect-node";

const transport = createConnectTransport({
  baseUrl: "https://api.example.com",
  httpVersion: "2",
});

const client = createServerReflectionClient(transport);

// Call unary method using full path
const response = await client.call("mypackage.MyService/Say", {
  sentence: "Hello, world!",
});

// Call server streaming method
for await (const msg of client.serverStream("mypackage.MyService/SayStream", {
  sentence: "Hello",
})) {
  console.log(msg);
}

// Call client streaming method
async function* requests() {
  yield { sentence: "Hello" };
  yield { sentence: "World" };
}
const result = await client.clientStream(
  "mypackage.MyService/SayClientStream",
  requests(),
);
console.log(result);

// Call bidirectional streaming method
for await (const msg of client.bidiStream(
  "mypackage.MyService/SayBidi",
  requests(),
)) {
  console.log(msg);
}
```

### Using Proxy-based Service Client

For a more fluent API, use `service()` to get a Proxy-based client:

```typescript
const client = createServerReflectionClient(transport);

// Get a service proxy
const echo = client.service("mypackage.MyService");

// Call methods directly by name (camelCase)
const response = await echo.say({ sentence: "Hello" });

// Server streaming
for await (const msg of echo.sayServerStream({ sentence: "Hello" })) {
  console.log(msg);
}

// Client streaming
async function* requests() {
  yield { sentence: "Hello" };
  yield { sentence: "World" };
}
const result = await echo.sayClientStream(requests());
console.log(result);

// Bidirectional streaming
for await (const msg of echo.sayBidi(requests())) {
  console.log(msg);
}
```

### Manual Method Invocation (Advanced)

For more control, you can manually build the registry and use `createClient`:

```typescript
import { createServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";
import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { createConnectTransport } from "@connectrpc/connect-node";

const transport = createConnectTransport({
  baseUrl: "https://api.example.com",
  httpVersion: "2",
});

// Discover and build registry
const reflectionClient = createServerReflectionClient(transport);
const registry = await reflectionClient.buildFileRegistry();

// Get service descriptor
const serviceDesc = registry.getService("mypackage.MyService");

// Create dynamic client
const client = createClient(serviceDesc, transport);

// Get input message type
const inputType = registry.getMessage("mypackage.SayRequest");

// Create request dynamically
const request = create(inputType, {
  sentence: "Hello, world!",
});

// Call method
const response = await client.say(request);
console.log(response.sentence);
```

### Using Cached Client

Reduce network calls by caching file and service descriptors:

```typescript
import { CachedServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";

const client = new CachedServerReflectionClient(transport);

// First call - fetches from server
const service1 = await client.getServiceDescriptor("mypackage.MyService");

// Second call - returns from cache (no network call)
const service2 = await client.getServiceDescriptor("mypackage.MyService");

// Check cache statistics
const stats = client.getCacheStats();
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);

// Clear cache when needed
client.clearCache();
```

### Formatting Utilities

```typescript
import {
  formatServiceList,
  formatServiceDescriptor,
  formatMethodDescriptor,
} from "@lambdalisue/connectrpc-grpcreflect/client";

const services = await client.listServices();
console.log(formatServiceList(services));

const service = await client.getServiceDescriptor("mypackage.MyService");
console.log(formatServiceDescriptor(service));
```

## API Reference

### Server API

#### Functions

- `registerServerReflectionFromFileDescriptorSet(router, fileDescriptorSet)` - Register from FileDescriptorSet object
- `registerServerReflectionFromUint8Array(router, data)` - Register from binary data
- `registerServerReflectionFromFile(router, path)` - Register from file path

### Client API

#### Classes

- `ServerReflectionClient` - Main client for v1 protocol
- `CachedServerReflectionClient` - Client with caching support

#### Client Methods

**Reflection Methods:**

- `listServices()` - List all available services
- `getFileByFilename(filename)` - Get file descriptor by filename
- `getFileContainingSymbol(symbol)` - Get file containing a symbol
- `getFileContainingExtension(type, number)` - Get file containing an extension
- `getAllExtensionNumbersOfType(type)` - Get all extension numbers
- `getServiceDescriptor(serviceName)` - Get service metadata
- `getMethodDescriptor(serviceName, methodName)` - Get method metadata
- `buildFileRegistry()` - Build complete FileRegistry

**Dynamic Method Invocation:**

- `call(path, request)` - Call a unary method (e.g., `"package.Service/Method"`)
- `serverStream(path, request)` - Call a server streaming method
- `clientStream(path, requests)` - Call a client streaming method
- `bidiStream(path, requests)` - Call a bidirectional streaming method
- `service(serviceName)` - Get a Proxy-based service client for fluent method calls

#### Cache Methods (CachedServerReflectionClient)

- `clearCache()` - Clear all caches
- `clearFileCache()` - Clear file caches only
- `clearServiceCache()` - Clear service caches only
- `getCacheStats()` - Get cache statistics
- `resetCacheStats()` - Reset statistics

#### Factory Functions

- `createServerReflectionClient(transport)` - Create client from transport

#### Utilities

- `formatServiceList(services)` - Format service list
- `formatServiceDescriptor(service)` - Format service descriptor
- `formatMethodDescriptor(method)` - Format method descriptor

### Protocol Versions

Both v1 and v1alpha protocols are supported:

```typescript
// Using v1 (recommended)
import { v1 } from "@lambdalisue/connectrpc-grpcreflect/client";
const client = new v1.ServerReflectionClient(transport);

// Using v1alpha
import { v1alpha } from "@lambdalisue/connectrpc-grpcreflect/client";
const client = new v1alpha.ServerReflectionClient(transport);
```

## Resource Management

### Client Disposal

`ServerReflectionClient` and `CachedServerReflectionClient` implement the `AsyncDisposable` interface for proper resource cleanup. This cancels any in-flight requests when the client is disposed.

```typescript
// Using await using (recommended)
{
  await using client = new ServerReflectionClient(transport);
  const services = await client.listServices();
  // Client is automatically disposed when leaving this block
}

// Or manually close
const client = new ServerReflectionClient(transport);
try {
  const services = await client.listServices();
} finally {
  await client.close();
}
```

### Request Cancellation

All client methods accept an optional `CallOptions` parameter for individual request cancellation:

```typescript
const abortController = new AbortController();

// Cancel the request after 5 seconds
setTimeout(() => abortController.abort(), 5000);

try {
  const services = await client.listServices({
    signal: abortController.signal,
  });
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Request was cancelled");
  }
}
```

### Closing HTTP/2 Connections

The `ServerReflectionClient` receives a `Transport` instance, but the `Transport` interface in ConnectRPC does not expose a method to close the underlying HTTP/2 connection. To properly close HTTP/2 connections, you need to manage the session at the transport level using `Http2SessionManager`:

```typescript
import { createGrpcTransport } from "@connectrpc/connect-node";
import { Http2SessionManager } from "@connectrpc/connect-node";

// Create a session manager for connection lifecycle control
const sessionManager = new Http2SessionManager("https://api.example.com");

const transport = createGrpcTransport({
  baseUrl: "https://api.example.com",
  sessionManager, // Pass the session manager
});

const client = new ServerReflectionClient(transport);

try {
  const services = await client.listServices();
  console.log(services);
} finally {
  // Close the client (cancels in-flight requests)
  await client.close();

  // Close the HTTP/2 connection
  sessionManager.abort();
}
```

> [!NOTE]
> The `Http2SessionManager.abort()` method closes all HTTP/2 sessions managed by that instance. If you're sharing a transport across multiple clients, only call `abort()` when all clients are done.

## Package Structure

```
@lambdalisue/connectrpc-grpcreflect
├── /server      - Server-side reflection implementation
├── /client      - Client-side reflection implementation
└── /common      - Shared utilities (FileRegistry helpers)
```

### Import Paths

```typescript
// Server API (backward compatible)
import { registerServerReflectionFromFile } from "@lambdalisue/connectrpc-grpcreflect";

// Explicit server import
import { registerServerReflectionFromFile } from "@lambdalisue/connectrpc-grpcreflect/server";

// Client API
import { createServerReflectionClient } from "@lambdalisue/connectrpc-grpcreflect/client";

// Common utilities
import { getFileByFilename } from "@lambdalisue/connectrpc-grpcreflect/common";
```

## Development

### Prerequisites

- Node.js v18+
- pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/lambdalisue/ts-connectrpc-grpcreflect.git
cd ts-connectrpc-grpcreflect

# Install dependencies
pnpm install

# Generate protobuf code
pnpm run gen

# Build
pnpm run build

# Run tests
pnpm test
```

### Scripts

- `pnpm run gen` - Generate code from protobuf definitions
- `pnpm run build` - Build the project
- `pnpm run dev` - Build in watch mode
- `pnpm test` - Run tests
- `pnpm run lint` - Run linting
- `pnpm run typecheck` - Run type checking
- `pnpm run fmt` - Format code

## License

MIT

---

## Credits

This implementation is based on the [gRPC Server Reflection Protocol](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md).
