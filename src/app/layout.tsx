import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Youth Community",
  description: "Multi-tenant youth community platform with gamification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
