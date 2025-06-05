import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import tailwindcss from "@tailwindcss/vite";

// const typedManifest: ManifestV3Export = {
//   ...manifest,
//   background: {
//     ...manifest.background,
//     type: "module"
//   }
// } as ManifestV3Export;

// console.log(typedManifest);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), crx({ manifest }), tailwindcss()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    // Add any other environment variables here
  },
  build: {
    emptyOutDir: true,
    target: "esnext",
    rollupOptions: {
      input: {
        popup: "index.html"
      }
    }
  }
}));
