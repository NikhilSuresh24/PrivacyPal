import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";
import tailwindcss from "@tailwindcss/vite";
import path from 'path'

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
  plugins: [
    react(), 
    crx({ manifest }), 
    tailwindcss(),
  ],
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
      },
      output: {
        assetFileNames: (assetInfo) => {
          // Keep the same asset name for images to avoid duplication
          if (assetInfo.name && /\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name)) {
            return 'assets/[name].[ext]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
