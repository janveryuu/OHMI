import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app/",
    name: "OHMI | Your Circuit Buddy",
    short_name: "OHMI",
    description: "A little help for your next bright circuit idea.",
    start_url: "/app/",
    scope: "/app/",
    display: "standalone",
    background_color: "#f5f8f7",
    theme_color: "#08776b",
    lang: "en",
    icons: [
      {
        src: "/app/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Ask OHMI", url: "/app/ask/" },
      { name: "Circuit Checker", url: "/app/checker/" },
    ],
  };
}
