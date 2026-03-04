import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SATS-AI | Decentralized AI Inference",
  description:
    "Censorship-resistant AI inference marketplace on Bitcoin + Nostr. Pay per token in sats.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistMono.variable} antialiased`}>
        <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <a href="/" className="text-lg font-bold tracking-wider text-accent">
              SATS·AI
            </a>
            <div className="flex gap-4 text-sm text-muted sm:gap-6">
              <a href="/send" className="hover:text-foreground transition-colors">
                Inference
              </a>
              <a href="/markets" className="hover:text-foreground transition-colors">
                Markets
              </a>
              <a href="/nodes" className="hover:text-foreground transition-colors">
                Nodes
              </a>
              <a href="/resolve" className="hover:text-foreground transition-colors">
                Resolve
              </a>
              <a href="/run" className="hover:text-foreground transition-colors">
                Run Node
              </a>
            </div>
          </div>
        </nav>
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}
