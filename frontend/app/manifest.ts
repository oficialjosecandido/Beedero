import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const base: MetadataRoute.Manifest = {
    id: "/",
    name: "Beedero",
    short_name: "Beedero",
    description: "The verified record of your startup.",
    start_url: "/feed?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#050604",
    // Prefer opening in-scope links (e.g. magic-link emails) in the installed
    // PWA instead of a browser tab. Supported on Chromium; ignored elsewhere.
    launch_handler: {
      client_mode: ["navigate-existing", "auto"],
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  // Chromium link-capture preference — not yet on MetadataRoute.Manifest.
  return { ...base, handle_links: "preferred" } as MetadataRoute.Manifest;
}
