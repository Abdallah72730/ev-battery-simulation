/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: `next build` writes plain HTML/JS to ./out, which Cloudflare Pages
  // serves for free with unmetered bandwidth. No Node server needed.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;