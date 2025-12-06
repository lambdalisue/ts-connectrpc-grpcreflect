import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: [
      "./src/index.ts",
      "./src/server/index.ts",
      "./src/client/index.ts",
      "./src/common/registry.ts",
    ],
    platform: "neutral",
    dts: true,
  },
]);
