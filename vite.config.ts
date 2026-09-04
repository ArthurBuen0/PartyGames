import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icones/favicon.svg", "icones/apple-touch-icon.png"],
      manifest: {
        name: "Party Games — jogos rápidos para a turma",
        short_name: "Party Games",
        description:
          "Crie uma sala, chame a galera e joguem juntos: sete brincadeiras rápidas sincronizadas em tempo real.",
        lang: "pt-BR",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#faf7ff",
        theme_color: "#6d28d9",
        categories: ["games", "entertainment", "social"],
        icons: [
          { src: "icones/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icones/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icones/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        // A sala é ao vivo: nada de servir estado de jogo do cache.
        navigateFallbackDenylist: [/^\/rest\//, /^\/realtime\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "fontes",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Separa as bibliotecas do código do app: elas mudam pouco e ficam
        // em cache entre deploys, em vez de baixar tudo de novo a cada ajuste.
        manualChunks: {
          supabase: ["@supabase/supabase-js"],
          react: ["react", "react-dom", "react-router-dom"]
        }
      }
    }
  },
  server: { port: 5173, host: true }
});
