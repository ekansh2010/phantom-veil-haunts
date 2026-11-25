import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    // Local dev: forward API calls to the Express server (npm run dev:server).
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: they change far less often than app code.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
