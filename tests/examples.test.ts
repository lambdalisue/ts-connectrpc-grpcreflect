/**
 * Integration tests for example scripts
 *
 * These tests verify that the example scripts in examples/ directory work correctly
 * by spawning them as subprocesses against a real server.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import * as path from "node:path";
import * as net from "node:net";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const TSX_BIN = path.resolve("node_modules/.bin/tsx");

/**
 * Find an available port
 */
function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Failed to get port"));
      }
    });
    server.on("error", reject);
  });
}

/**
 * Spawns a process and returns a promise that resolves with stdout/stderr.
 */
function runScript(
  script: string,
  args: string[] = [],
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(TSX_BIN, [script, ...args], {
      env: { ...process.env, ...env },
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

describe("Examples Integration Tests", () => {
  let serverProcess: ChildProcess;
  let testPort: number;

  beforeAll(async () => {
    // Get an available port
    testPort = await getAvailablePort();

    // Start the server as a subprocess
    serverProcess = spawn(TSX_BIN, ["examples/server-basic.ts"], {
      env: { ...process.env, PORT: String(testPort) },
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = global.setTimeout(() => {
        reject(new Error("Server failed to start within timeout"));
      }, 30000);

      serverProcess.stdout?.on("data", (data) => {
        if (data.toString().includes("Server running")) {
          global.clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr?.on("data", (data) => {
        const msg = data.toString();
        // Ignore common warnings, only log real errors
        if (!msg.includes("npm warn")) {
          console.error("Server stderr:", msg);
        }
      });

      serverProcess.on("error", (err) => {
        global.clearTimeout(timeout);
        reject(err);
      });
    });

    // Give the server a moment to fully initialize
    await setTimeout(100);
  }, 35000);

  afterAll(async () => {
    // Shutdown the server
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = global.setTimeout(() => {
          serverProcess.kill("SIGKILL");
          resolve();
        }, 3000);

        serverProcess.on("close", () => {
          global.clearTimeout(timeout);
          resolve();
        });
      });
    }
  });

  describe("examples/client-list-services.ts", () => {
    it("should list available services", async () => {
      const result = await runScript("examples/client-list-services.ts", [], {
        PORT: String(testPort),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Available services:");
      expect(result.stdout).toContain("grpc.reflection.v1.ServerReflection");
    }, 30000);
  });

  describe("examples/client-inspect-service.ts", () => {
    it("should inspect a service and display methods", async () => {
      const result = await runScript(
        "examples/client-inspect-service.ts",
        ["grpc.reflection.v1.ServerReflection"],
        { PORT: String(testPort) },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("ServerReflection");
      expect(result.stdout).toContain("method(s)");
      expect(result.stdout).toContain("ServerReflectionInfo");
    }, 30000);
  });

  describe("examples/client-cached.ts", () => {
    it("should demonstrate caching with hit/miss stats", async () => {
      const result = await runScript("examples/client-cached.ts", [], {
        PORT: String(testPort),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Fetching services (first call)");
      expect(result.stdout).toContain("Fetching services (second call)");
      expect(result.stdout).toContain("hits");
      expect(result.stdout).toContain("misses");
      expect(result.stdout).toContain("Cache cleared!");
    }, 30000);
  });

  describe("examples/client-call-method.ts", () => {
    it("should dynamically call a method", async () => {
      const result = await runScript("examples/client-call-method.ts", [], {
        PORT: String(testPort),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Discovering services...");
      expect(result.stdout).toContain("Building file registry...");
      expect(result.stdout).toContain("grpc.reflection.v1.ServerReflection");
      expect(result.stdout).toContain("Method info:");
      expect(result.stdout).toContain("Request message fields:");
      // Verify the method was actually called
      expect(result.stdout).toContain("Calling method dynamically");
      expect(result.stdout).toContain("Services from dynamic call:");
      expect(result.stdout).toContain("Dynamic method call complete");
    }, 30000);
  });

  describe("examples/client-dynamic-call.ts", () => {
    it("should call methods using simplified dynamic API", async () => {
      const result = await runScript("examples/client-dynamic-call.ts", [], {
        PORT: String(testPort),
      });

      expect(result.exitCode).toBe(0);
      // Verify list services works
      expect(result.stdout).toContain("=== List Services ===");
      expect(result.stdout).toContain("Available services:");
      // Verify DynamicDispatchClient.bidiStream() method works
      expect(result.stdout).toContain(
        "=== Method 1: Using DynamicDispatchClient.bidiStream() ===",
      );
      expect(result.stdout).toContain(
        "Services from DynamicDispatchClient.bidiStream:",
      );
      // Verify ProxyDispatchClient works
      expect(result.stdout).toContain(
        "=== Method 2: Using ProxyDispatchClient ===",
      );
      expect(result.stdout).toContain("Services from ProxyDispatchClient:");
      expect(result.stdout).toContain("=== Done ===");
    }, 30000);
  });
});
