import { fetchEmbeddings } from "./openai.js";

const DOCS_BASE_URL = "https://developers.cloudflare.com";

export const OWNER = "cloudflare";
export const REPO_NAME = "cloudflare-docs";

export const TOP_DIR = "content";
export const SUB_DIRS = [
  "analytics/analytics-engine",
  "cloudflare-for-platforms/workers-for-platforms",
  "d1",
  "images",
  "pages",
  "pub-sub",
  "queues",
  "r2",
  "stream",
  "workers",
];
export const FULL_DIRS = SUB_DIRS.map((d) => `${TOP_DIR}/${d}`);

/**
 * @param {string} filePath
 * @param {string} fileId
 * @param {string} markdownText
 * @returns {Chunk[]}
 */
export function textToChunks(filePath, fileId, markdownText) {
  let chunks = [];

  if (!markdownText) {
    console.error("no text!", filePath, fileId);
    return [];
  }

  let title = (markdownText.match(/^title: (.+)$/m) ?? [])[1];

  if (title == null) {
    console.warn("No title:", filePath);
    return [];
  }

  markdownText = markdownText
    .replace(/---.+?---/ms, "")
    .replace(/<!--.+?-->/ms, "")
    .replace(/{{.+?}}/g, "")
    .replace(/\[(.+?)\]\(.+\)/g, "$1")
    .replace(/\n\n+/g, "\n\n")
    // .replace(/(?<!\n)\n(?!\n)/g, ' ')
    // .replace(/\s+/g, " ")
    .trim();

  if (markdownText.length < 100) {
    console.warn("Too short:", filePath);
    return [];
  }

  const WORD_DELIMITER = " ";
  const CHUNK_WORD_SIZE = 640;

  const docWords = markdownText.split(WORD_DELIMITER);

  /** @type {string[]} */
  let titleWords = [];
  let bodyWordSize = CHUNK_WORD_SIZE;
  for (
    let wordIx = 0, chunkIx = 0;
    wordIx < docWords.length;
    wordIx += bodyWordSize, chunkIx++
  ) {
    if (chunkIx === 1) {
      // Prepend the document title to extra chunks for context – does this help?
      titleWords = `# ${title}\n\n`.split(WORD_DELIMITER);
      bodyWordSize = CHUNK_WORD_SIZE - titleWords.length;
    }
    const bodyWords = docWords.slice(wordIx, wordIx + bodyWordSize);
    if (!bodyWords.length) continue;
    const text = titleWords.concat(bodyWords).join(WORD_DELIMITER);

    chunks.push({
      id: chunkId(fileId, chunkIx),
      filePath,
      fileId,
      title,
      text,
    });
  }

  return chunks;
}

/**
 * @param {string} apiKey
 * @param {Chunk[]} chunks
 */
export async function fetchChunkEmbeddings(apiKey, chunks) {
  const fetches = [];
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    fetches.push(
      fetchEmbeddings(
        chunks.slice(i, i + BATCH_SIZE).map((chunk) => chunk.text),
        apiKey
      )
    );
  }
  const responses = await Promise.all(fetches);

  return responses
    .map(({ data, error }, fetchIx) => {
      if (error != null) {
        console.error({ fetchIx, error });
        return [];
      }
      return data.map(({ embedding }, embeddingIx) => ({
        id: chunks[fetchIx * BATCH_SIZE + embeddingIx].id,
        embedding,
      }));
    })
    .flat();
}

/**
 * @param {string} path
 */
export function pathToUrl(path) {
  const prefix = `${TOP_DIR}/`;
  path = (path.startsWith(prefix) ? path.slice(prefix.length) : path)
    .replace(/_index\.md$/, "")
    .replace(/\.md$/, "");
  return `${DOCS_BASE_URL}/${path}`;
}

const OID_PREFIX_CHARS = 12;
const CHUNK_IX_CHARS = 4;

/**
 * @param {string} oid
 */
export function oidPrefix(oid) {
  return oid.slice(0, OID_PREFIX_CHARS);
}

// ID is first 12 hex characters of git object id, plus 4 hex chars for chunk index
// So, 16 / 2 = 8 bytes = 64 bits
/**
 * @param {string} oid
 * @param {number} chunkIx
 */
function chunkId(oid, chunkIx) {
  return oidPrefix(oid) + chunkIx.toString(16).padStart(CHUNK_IX_CHARS, "0");
}
