import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GUSTO URBANO | Delivery Montevideo",
  description: "Pizza, hamburguesas y empanadas. El sabor que mueve la ciudad.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#e63d32",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-UY"><body>{children}</body></html>;
}
