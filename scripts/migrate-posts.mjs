import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.resolve(projectRoot, "..", "source", "_posts");
const targetRoot = path.join(projectRoot, "content", "posts");

async function main() {
  await fs.mkdir(targetRoot, { recursive: true });
  const entries = await fs.readdir(targetRoot, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) =>
      fs.rm(path.join(targetRoot, entry.name), {
        recursive: true,
        force: true
      })
    )
  );
  await fs.cp(sourceRoot, targetRoot, { recursive: true });
  console.log(`Migrated posts from ${sourceRoot} to ${targetRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
