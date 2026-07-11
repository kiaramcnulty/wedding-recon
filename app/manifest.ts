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
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Dedicated maskable variant: mark padded into the safe zone on a filled
      // background so Android's icon mask doesn't clip the magnifier handle.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
