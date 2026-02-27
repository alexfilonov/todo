import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Caltodo Dashboard",
  description: "Hosted dashboard for Canvas to Google Tasks sync",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
