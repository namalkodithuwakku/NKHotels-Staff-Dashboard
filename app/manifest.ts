import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NKH Dashboard",
    short_name: "NKH",
    description: "N K Hotels operations, tasks, inboxes, roster and property workspace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f6",
    theme_color: "#20252b",
    orientation: "any",
    categories: ["business", "productivity"],
    icons: [
      { src: "/api/pwa-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon?size=512&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
