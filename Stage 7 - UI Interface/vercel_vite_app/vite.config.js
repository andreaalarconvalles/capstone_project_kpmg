import { defineConfig } from "vite";

function vendorChunk(id) {
  if (!id.includes("node_modules")) return undefined;

  const normalized = id.replaceAll("\\", "/");
  if (normalized.includes("/react/") || normalized.includes("/react-dom/") || normalized.includes("/scheduler/")) {
    return "vendor-react";
  }
  if (normalized.includes("/recharts/")) {
    return "vendor-recharts";
  }
  if (normalized.includes("/victory-vendor/")) {
    return "vendor-victory";
  }
  if (normalized.includes("/d3-")) {
    return "vendor-d3";
  }
  if (normalized.includes("/lucide-react/dist/esm/icons/")) {
    const filename = normalized.split("/").pop() || "";
    const first = filename[0] || "misc";
    if (first < "g") return "vendor-icons-a-f";
    if (first < "n") return "vendor-icons-g-m";
    if (first < "t") return "vendor-icons-n-s";
    return "vendor-icons-t-z";
  }
  if (normalized.includes("/lucide-react/") || normalized.includes("/lucide/")) {
    return "vendor-icons-core";
  }
  if (normalized.includes("/leaflet/") || normalized.includes("/react-leaflet/")) {
    return "vendor-maps";
  }
  return "vendor-core";
}

export default defineConfig({
  esbuild: {
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment"
  },
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  preview: {
    host: "127.0.0.1",
    port: 4173
  },
  build: {
    rolldownOptions: {
      checks: {
        pluginTimings: false
      },
      output: {
        manualChunks: vendorChunk
      }
    }
  }
});
