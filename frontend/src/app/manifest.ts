import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChessInt — Chess Intelligence",
    short_name: "ChessInt",
    description:
      "ChessInt turns your Lichess and Chess.com games into chess intelligence — engine analysis, recurring weaknesses, and a personal AI coach.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b141d",
    theme_color: "#0b141d",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
    ],
  };
}
