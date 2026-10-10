// Copies the static homepage into public/ so Next.js can serve it at "/".
// The root index.html stays the source of truth (it is also what GitHub Pages serves today).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(join(root, "index.html"), join(root, "public", "index.html"));
console.log("Synced index.html -> public/index.html");
