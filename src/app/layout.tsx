import type { Metadata } from "next";
import "./globals.css";
import { DevUserSwitcher } from "@/components/DevUserSwitcher";

export const metadata: Metadata = {
  title: "Youth Community",
  description: "Multi-tenant youth community platform with gamification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <DevUserSwitcher />}
      </body>
    </html>
  );
}
