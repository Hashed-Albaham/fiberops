import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = "/home/ubuntu/requirements-site";
const ignored = new Set([".git", "node_modules", "dist", "coverage", "scripts"]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const isHiddenDiagnosticDirectory = entry.isDirectory() && entry.name.startsWith(".") && entry.name.endsWith("-logs");
    if (ignored.has(entry.name) || entry.name === ".env" || isHiddenDiagnosticDirectory) return [];
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    const file = relative(root, absolute).replaceAll("\\", "/");
    return [{ file, data: readFileSync(absolute, "utf8"), encoding: "utf-8" }];
  });
}

const payload = {
  teamId: "team_ZGObUleR1oEerMp7GqoPUJPz",
  name: "fiberops-console",
  target: "production",
  files: walk(root),
};

writeFileSync("/tmp/fiberops-vercel-input.json", JSON.stringify(payload));
console.log(`Prepared ${payload.files.length} source files for Vercel.`);
