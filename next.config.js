const path = require("path");

const projectRoot = path.resolve(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Parent ~/package-lock.json can make Turbopack pick the wrong workspace root.
  // Pin both tracing and turbopack to this project directory.
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
};

module.exports = nextConfig;
