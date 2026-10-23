import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import "./theme.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Smart Repute | AI replies for your Google reviews",
  description:
    "Smart Repute helps business owners read their Google Business Profile reviews, draft replies with AI, approve them, and publish them to Google. See your rating and set a goal for it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} h-full antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
