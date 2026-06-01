import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      router: {
        autoCodeSplitting: false,
        importRoutesUsingAbsolutePaths: false,
        quoteStyle: "double"
      }
    }),
    viteReact(),
    nitro()
  ],
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: "./src/server.ts"
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
