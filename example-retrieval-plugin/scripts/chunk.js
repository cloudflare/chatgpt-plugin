import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OWNER, REPO_NAME, FULL_DIRS, textToChunks } from "../shared/docs.js";

const repo = `https://github.com/${OWNER}/${REPO_NAME}`;

const cloneDir = mkdtempSync(join(tmpdir(), "chunk-"));

execSync(
  [
    `git clone --depth=1 --filter=blob:none --sparse ${repo} ${cloneDir}`,
    `git sparse-checkout set ${FULL_DIRS.join(" ")}`,
  ].join(" && "),
  { cwd: cloneDir, stdio: "inherit" }
);

const objects = execSync(
  `git rev-list --all --objects ${FULL_DIRS.join(" ")}`,
  { cwd: cloneDir, encoding: "utf8" }
);

const filesWithContents = objects
  .trim()
  .split("\n")
  .filter((line) => line.endsWith(".md"))
  .map((line) => ({
    oid: line.slice(0, 40),
    path: line.slice(41),
    text: readFileSync(join(cloneDir, line.slice(41)), "utf8"),
  }));

const chunks = filesWithContents
  .map(({ path, oid, text }) => textToChunks(path, oid, text))
  .flat();

console.error("Number of files: ", filesWithContents.length);
console.error("Number of chunks: ", chunks.length);

writeFileSync(
  "chunks.bulk.json",
  JSON.stringify(
    chunks.map((chunk) => ({
      key: "chunk:" + chunk.id,
      value: JSON.stringify(chunk),
    }))
  )
);

// Not really necessary, but easier to debug than the bulk json
writeFileSync(
  "chunks.ndjson",
  chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + "\n"
);
