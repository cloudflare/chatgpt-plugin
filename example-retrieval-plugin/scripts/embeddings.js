import { readFileSync, writeFileSync } from "node:fs";
import { fetchChunkEmbeddings } from "../shared/docs.js";
import { VectorCollection } from "../shared/vector.js";

const { OPENAI_API_KEY } = process.env;

if (OPENAI_API_KEY == null) {
  console.error("OPENAI_API_KEY must be set");
  process.exit(1);
}

/** @type {Chunk[]} */
const chunks = readFileSync("./chunks.ndjson", "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

main().catch(console.error);

async function main() {
  const chunkEmbeddings = await fetchChunkEmbeddings(
    OPENAI_API_KEY ?? "",
    chunks
  );

  const vectorCollection = VectorCollection.from(chunkEmbeddings);

  console.error("Number of embeddings:", vectorCollection.length);
  console.error("Embedding length:", vectorCollection.embeddingLength);

  writeFileSync("embeddings.bin", new Uint8Array(vectorCollection.buffer));
}
