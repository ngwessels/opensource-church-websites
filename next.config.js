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
  async redirects() {
    return [
      // Bulletins moved from the page editor into Builder → Admin.
      {
        source: "/builder/bulletins",
        destination: "/builder/admin/bulletins",
        permanent: false,
      },
      {
        source: "/builder/admin/email-list",
        destination: "/builder/admin/email",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "files.ecatholic.com",
      },
    ],
  },
};

module.exports = nextConfig;
