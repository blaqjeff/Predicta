import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { Nav } from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Predicta — Onchain Prediction Leaderboard",
  description:
    "Predict match outcomes across weighted categories and climb the onchain leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="grain" aria-hidden />
        <SessionProvider>
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="mt-12 border-t border-[var(--border)]">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-7 text-sm text-[var(--muted)] sm:flex-row">
              <span>
                <span className="font-semibold text-[var(--foreground)]">
                  predict<span className="text-[var(--accent)]">a</span>
                </span>{" "}
                · onchain predictions
              </span>
              <span className="chip">Solana · Devnet</span>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
