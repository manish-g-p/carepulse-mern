import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on all interfaces so the dockerized nginx gateway can reach the
    // dev server via host.docker.internal (localhost-only binding refuses it).
    host: true,
  },
});
