import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EV Battery Health Estimator",
  description:
    "See how your electric vehicle's battery is likely to age in your climate and with your charging habits, using an open electrochemical model (PyBaMM).",
};

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="frame">
          <header className="masthead">
            <Link href="/" className="name">Battery Health Estimator</Link>
            <nav>
              <Link href="/about/">How it works</Link>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="colophon">
            <p>Estimates from a physics model, not a diagnosis of a specific vehicle.</p>
            {SUPPORT_URL && (
              <p>
                <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Support the project</a>
              </p>
            )}
          </footer>
        </div>
      </body>
    </html>
  );
}
