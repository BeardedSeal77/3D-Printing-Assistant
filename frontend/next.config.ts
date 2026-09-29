import type { NextConfig } from "next"

const API_URL = process.env.API_URL ?? "http://localhost:5328"

const nextConfig: NextConfig = {
  // Proxy /api/* to the Flask backend so the browser talks to one origin.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }]
  },
}

export default nextConfig
