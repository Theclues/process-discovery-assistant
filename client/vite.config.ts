import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing vendors into cacheable chunks so the
        // app shell loads fast and only the relevant chunk is fetched per view.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-flow": ["@xyflow/react"],
          "vendor-data": ["@tanstack/react-query"],
          "vendor-markdown": ["react-markdown"],
        },
      },
    },
  },
});
