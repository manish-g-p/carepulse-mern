import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on all interfaces so the dockerized nginx gateway can reach the
    // dev server via host.docker.internal (localhost-only binding refuses it).
    host: true,
    // Allow the dev server to be reached through a Cloudflare quick tunnel
    // (public demo of the full local stack); Vite otherwise blocks unknown
    // Host headers. localhost/127.0.0.1 are always allowed.
    allowedHosts: [".trycloudflare.com"],
  },
});
