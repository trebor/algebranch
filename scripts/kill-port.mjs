#!/usr/bin/env node

/**
 * Port Killer Utility
 * Finds and kills any processes holding onto a specified port.
 * Usage: node scripts/kill-port.mjs <port>
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const port = args.find(arg => !arg.startsWith('-')) || args.find(arg => arg.startsWith('--port='))?.split('=')[1];

if (!port) {
  console.error('\n❌ Error: No port specified.');
  console.error('Usage: node scripts/kill-port.mjs <port>\nExample: node scripts/kill-port.mjs 3001\n');
  process.exit(1);
}

try {
  // lsof -t -i :<port> returns only the PIDs on separate lines
  const stdout = execSync(`lsof -t -i :${port}`, { encoding: 'utf8' }).trim();
  if (stdout) {
    const pids = stdout.split('\n');
    console.log(`\n🔍 Found process(es) on port ${port}: ${pids.join(', ')}`);
    for (const pid of pids) {
      if (pid) {
        console.log(`💥 Killing PID ${pid}...`);
        execSync(`kill -9 ${pid}`);
      }
    }
    console.log(`✅ Port ${port} is now free.\n`);
  } else {
    console.log(`\nℹ️ No active processes found on port ${port}.\n`);
  }
} catch (error) {
  // lsof returns exit code 1 if no process is found, which throws in execSync
  console.log(`\nℹ️ No active processes found on port ${port}.\n`);
}
