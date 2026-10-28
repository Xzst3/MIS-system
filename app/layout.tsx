import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL
      : "http://localhost:3000",
  ),
  title: {
    default: "The Elder Care Foundation | A clearer path, together.",
    template: "%s | The Elder Care Foundation",
  },
  description:
    "Information, guidance and trusted connections to help older adults and their families navigate the next chapter with confidence.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "A clearer path, together.",
    description:
      "The Elder Care Foundation connects older adults and families with information, guidance and trusted external support.",
    type: "website",
    images: ["/images/a-little-guidance.webp"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
