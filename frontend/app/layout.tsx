import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EV Battery Health Estimator — physics-based degradation forecast",
  description:
    "Estimate how your electric vehicle battery will age in your climate and with your charging habits, using an open electrochemical model (PyBaMM).",
};

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">⚡ Battery Health Estimator</Link>
          <nav>
            <Link href="/about/">How it works</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <p>Built with FastAPI, PyBaMM and Next.js. Results are estimates, not a warranty assessment.</p>
          {SUPPORT_URL && (
            <p>
              Find this useful? <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">☕ Support the project</a>
            </p>
          )}
        </footer>
      </body>
    </html>
  );
}