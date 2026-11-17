import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GUSTO URBANO",
    short_name: "Gusto Urbano",
    description: "Delivery de pizzas, hamburguesas y empanadas en Montevideo",
    start_url: "/",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#e63d32",
    icons: []
  };
}
