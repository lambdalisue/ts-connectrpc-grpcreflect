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

Dynamically call gRPC methods using reflection without generated code.

This example demonstrates:
1. Discovering services using reflection
2. Building a FileRegistry with all type information
3. Creating a dynamic client using service descriptors
4. Inspecting message fields at runtime
5. Actually calling the method and receiving responses

```bash
PORT=8090 npx tsx examples/client-call-method.ts
```

Example output:
```
Discovering services...
Found 2 services

Building file registry...

Using service: grpc.reflection.v1.ServerReflection

Method info: ServerReflectionInfo
  Input type: grpc.reflection.v1.ServerReflectionRequest
  Output type: grpc.reflection.v1.ServerReflectionResponse
  Streaming: client=true, server=true

Request message fields:
  - host (scalar)
  - file_by_filename (scalar)
  - file_containing_symbol (scalar)
  - file_containing_extension (message)
  - all_extension_numbers_of_type (scalar)
  - list_services (scalar)

--- Calling method dynamically ---
Sending request: { messageRequest: { case: "listServices", value: "" } }

Response:
  Services from dynamic call:
    - grpc.reflection.v1.ServerReflection
    - grpc.reflection.v1alpha.ServerReflection

--- Dynamic method call complete ---
```

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
