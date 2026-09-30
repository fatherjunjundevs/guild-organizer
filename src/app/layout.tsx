import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RTNW Guild Organizer",
    template: "%s · RTNW Guild Organizer",
  },
  description:
    "An unofficial community tool for organizing guild rosters and event assignments in Ragnarok: The New World.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}