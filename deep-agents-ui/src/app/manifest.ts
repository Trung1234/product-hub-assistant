import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Printway Nexus - AI R&D Opportunity Hub",
    short_name: "Printway Nexus",
    description: "Hệ thống AI Copilot phát hiện cơ hội sản phẩm Print-on-Demand (POD) xuyên biên giới thời gian thực qua Amazon, Etsy & Pinterest.",
    start_url: "/",
    display: "standalone",
    background_color: "#080B21",
    theme_color: "#00FF88",
    icons: [
      {
        src: "/favicon.png",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
