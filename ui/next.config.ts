import type { NextConfig } from "next";
import os from "os";
import { readFileSync } from "fs";
import path from "path";

// Single source of truth for the app version (issue #157): the monorepo root
// package.json. Read at build time and exposed to the bundle so the UI can
// surface it at runtime (e.g. the About dialog, #140).
const appVersion: string = JSON.parse(
  readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
).version;

// Gather all local IPv4 addresses to automatically allow HMR connections from LAN devices
const localIPs: string[] = [];
const interfaces = os.networkInterfaces();
for (const name of Object.keys(interfaces)) {
  for (const net of interfaces[name] || []) {
    if (net.family === "IPv4" && !net.internal) {
      localIPs.push(net.address);
      localIPs.push(`${net.address}:3000`);
    }
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["math-engine"],
  // Allow hot module replacement (HMR) from mobile devices on the same local network
  allowedDevOrigins: [...localIPs, "localhost:3000"],
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;

