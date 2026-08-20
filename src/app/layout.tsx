import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Freddy",
  description: "Keep track of the things you are managing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The app is a phone-sized column; let it fill the notch area.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d10" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {/* One column, capped so the phone layout stays intact on a desktop. */}
        <div className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
