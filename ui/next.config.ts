import type { NextConfig } from "next";
import os from "os";

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
};

export default nextConfig;

