import type { Metadata } from "next";
import { Rajdhani, Montserrat } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-rajdhani",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "DGDAPP — Reconstitutions & Tournois",
  description:
    "Événements, tournois de reconstitution, profils de participants et plan de camp.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${rajdhani.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
