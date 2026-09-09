import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: "inherit", windowsHide: true });
    const stop = (signal) => child.kill(signal);
    const onInterrupt = () => stop("SIGINT");
    const onTerminate = () => stop("SIGTERM");
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onTerminate);
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });
}

export function pnpm(args) {
  if (!process.env.npm_execpath) throw new Error("Run this command using pnpm.");
  if (process.platform === "win32" && process.env.npm_execpath.toLowerCase().endsWith(".exe")) {
    return run(process.env.npm_execpath, args);
  }
  return run(process.execPath, [process.env.npm_execpath, ...args]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await pnpm(process.argv.slice(2));
  } catch {
    process.exitCode = 1;
  }
}
