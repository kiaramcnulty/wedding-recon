import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wedding Recon",
    short_name: "Wedding Recon",
    description: "Explore local wedding vendors and share your own recon.",
    start_url: "/explore",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1D9E75",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
