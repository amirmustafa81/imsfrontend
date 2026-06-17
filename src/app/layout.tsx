import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { ImsShell } from "@/components/ims/shell";

export const metadata: Metadata = {
  title: "UOH Inventory Management System",
  description: "Inventory and fixed asset management system for the University of Haripur.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ImsShell>{children}</ImsShell>
      </body>
    </html>
  );
}
