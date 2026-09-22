import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@mantine")) return "mantine";
          if (id.includes("@tabler")) return "tabler-icons";
          if (id.includes("react") || id.includes("scheduler")) return "react";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5175,
    host: "0.0.0.0",
    proxy: {
      // In development, proxy API calls to the backend
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
});
