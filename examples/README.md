# Examples

This directory contains example code for using `@lambdalisue/connectrpc-grpcreflect`.

> [!IMPORTANT]
> The [gRPC Reflection protocol specification](https://github.com/grpc/grpc/blob/master/doc/server-reflection.md) mandates bidirectional streaming for request consistency. When using Connect protocol, HTTP/2 is required. All examples use `httpVersion: "2"` in their transport configuration.

## Server Examples

### `server-basic.ts`

Basic server setup with reflection enabled. This is a working example that you can run directly.

```bash
# Start the server (default port: 8090)
npx tsx examples/server-basic.ts

# Or specify a custom port
PORT=9090 npx tsx examples/server-basic.ts
```

## Client Examples

All client examples support the `PORT` environment variable to specify the server port (default: 8080).

### `client-list-services.ts`

List all services from a gRPC server.

```bash
PORT=8090 npx tsx examples/client-list-services.ts
```

### `client-inspect-service.ts`

Inspect a service and display its methods.

```bash
PORT=8090 npx tsx examples/client-inspect-service.ts grpc.reflection.v1.ServerReflection
```

### `client-cached.ts`

Demonstrate caching functionality to reduce network calls.

```bash
PORT=8090 npx tsx examples/client-cached.ts
```

### `client-call-method.ts`

Dynamically call gRPC methods using reflection without generated code (manual approach).

This example demonstrates the step-by-step process:

1. Discovering services using reflection
2. Building a FileRegistry with all type information
3. Creating a dynamic client using service descriptors
4. Inspecting message fields at runtime
5. Actually calling the method and receiving responses

```bash
PORT=8090 npx tsx examples/client-call-method.ts
```

### `client-dynamic-call.ts`

**Recommended approach** - Call methods using the simplified dynamic API.

This example demonstrates:

1. Using `client.bidiStream()` for bidirectional streaming with full path
2. Using `client.service()` to get a Proxy-based service client
3. Calling methods directly by name (camelCase)

```bash
PORT=8090 npx tsx examples/client-dynamic-call.ts
```

Example output:

```
=== List Services ===
Available services:
  - grpc.reflection.v1.ServerReflection
  - grpc.reflection.v1alpha.ServerReflection

=== Method 1: Using bidiStream() ===
Services from bidiStream:
  - grpc.reflection.v1.ServerReflection
  - grpc.reflection.v1alpha.ServerReflection

=== Method 2: Using Proxy-based service() ===
Services from service() proxy:
  - grpc.reflection.v1.ServerReflection
  - grpc.reflection.v1alpha.ServerReflection

=== Done ===
```

**Key methods:**

- `client.call(path, request)` - Unary calls
- `client.serverStream(path, request)` - Server streaming
- `client.clientStream(path, requests)` - Client streaming
- `client.bidiStream(path, requests)` - Bidirectional streaming
- `client.service(name)` - Get Proxy-based service client

## Running Examples

### Quick Start (Self-contained)

The server example includes gRPC Reflection enabled, so you can test immediately:

```bash
# Terminal 1: Start the example server
npx tsx examples/server-basic.ts

# Terminal 2: Run client examples
PORT=8090 npx tsx examples/client-list-services.ts
PORT=8090 npx tsx examples/client-inspect-service.ts grpc.reflection.v1.ServerReflection
PORT=8090 npx tsx examples/client-cached.ts
PORT=8090 npx tsx examples/client-call-method.ts
PORT=8090 npx tsx examples/client-dynamic-call.ts  # Recommended
```

### Using Docker Compose

For testing with the echo server:

```bash
# Start the test server with gRPC Reflection enabled
docker compose up -d echo-connectrpc

# Run any example (default port 8080)
npx tsx examples/client-list-services.ts
npx tsx examples/client-inspect-service.ts echo.v1.Echo
npx tsx examples/client-cached.ts
npx tsx examples/client-call-method.ts
npx tsx examples/client-dynamic-call.ts  # Recommended

# Stop the server when done
docker compose down
```

### Against Your Own Server

To run these examples against your own server:

1. Install dependencies:

```bash
pnpm install
```

2. Ensure you have a gRPC server with reflection enabled running

3. Run an example with the `PORT` environment variable:

```bash
PORT=50051 npx tsx examples/client-list-services.ts
```
