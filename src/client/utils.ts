import type { ServiceDescriptor, MethodDescriptor } from "./types.js";

/**
 * Formats a list of service names into a readable string.
 *
 * @param services - Array of service names
 * @returns Formatted string representation
 */
export function formatServiceList(services: string[]): string {
  if (services.length === 0) {
    return "No services available";
  }
  return services.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

/**
 * Formats a service descriptor into a readable string.
 *
 * @param service - Service descriptor to format
 * @returns Formatted string representation
 */
export function formatServiceDescriptor(service: ServiceDescriptor): string {
  const lines: string[] = [];
  lines.push(`Service: ${service.fullName}`);
  lines.push(`Methods (${service.methods.length}):`);

  for (const method of service.methods) {
    const streamType =
      method.clientStreaming && method.serverStreaming
        ? "bidi stream"
        : method.clientStreaming
          ? "client stream"
          : method.serverStreaming
            ? "server stream"
            : "unary";

    lines.push(`  - ${method.name} (${streamType})`);
    lines.push(`      → ${method.inputType}`);
    lines.push(`      ← ${method.outputType}`);
  }

  return lines.join("\n");
}

/**
 * Formats a method descriptor into a readable string.
 *
 * @param method - Method descriptor to format
 * @returns Formatted string representation
 */
export function formatMethodDescriptor(method: MethodDescriptor): string {
  const streamType =
    method.clientStreaming && method.serverStreaming
      ? "bidi stream"
      : method.clientStreaming
        ? "client stream"
        : method.serverStreaming
          ? "server stream"
          : "unary";

  return `${method.fullName} (${streamType})\n  → ${method.inputType}\n  ← ${method.outputType}`;
}
