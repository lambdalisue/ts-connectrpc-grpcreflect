# @lambdalisue/connectrpc-grpcreflect

Server Reflection implementation for gRPC in ConnectRPC for ECMAScript/TypeScript.

## Overview

This project provides gRPC Server Reflection Protocol support for ConnectRPC services, enabling tools like `grpcurl` and `grpc_cli` to discover and interact with your services dynamically.

## Installation

```bash
npm install @lambdalisue/connectrpc-grpcreflect
```

## Usage

### Basic Usage

```typescript
import { ConnectRouter } from '@connectrpc/connect';
import { registerServerReflectionFromFileDescriptorSet } from '@lambdalisue/connectrpc-grpcreflect';
import { fileDescriptorSet } from './generated/descriptor_pb.js';

const router = new ConnectRouter();
// ... register your services

// Add reflection support
registerServerReflectionFromFileDescriptorSet(router, fileDescriptorSet);
```

### From Binary File

```typescript
import { registerServerReflectionFromFile } from '@lambdalisue/connectrpc-grpcreflect';

// Load FileDescriptorSet from a binary file
registerServerReflectionFromFile(router, './path/to/descriptor.binpb');
```

### From Uint8Array

```typescript
import { registerServerReflectionFromUint8Array } from '@lambdalisue/connectrpc-grpcreflect';

// Load from binary data
const binaryData = await fetch('/api/descriptor').then(res => res.arrayBuffer());
registerServerReflectionFromUint8Array(router, new Uint8Array(binaryData));
```

This adds both v1 and v1alpha versions of the gRPC Server Reflection Protocol to your ConnectRPC server, allowing tools like `grpcurl` to discover and interact with your services:

```bash
# List services
grpcurl -plaintext localhost:8080 list

# Describe a service
grpcurl -plaintext localhost:8080 describe mypackage.MyService

# Call a method
grpcurl -plaintext -d '{"name": "World"}' localhost:8080 mypackage.MyService/SayHello
```

## Development

### Prerequisites

- Node.js
- pnpm

### Setup

```bash
# Clone the repository
git clone https://github.com/lambdalisue/ts-connectrpc-grpcreflect.git
cd ts-connectrpc-grpcreflect

# Install dependencies
pnpm install

# Generate code
pnpm run gen
```

### Scripts

- `pnpm run gen` - Generate code from protobuf definitions
- `pnpm test` - Run tests
- `pnpm run build` - Build the project

## License

MIT