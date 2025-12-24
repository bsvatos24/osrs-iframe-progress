import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Use repo base only on build (for GitHub Pages). Dev should be "/".
  base: command === "build" ? "/osrs-iframe-progress/" : "/",
}));
