const OPENAI_BASE = "https://api.openai.com/v1";

/**
 * @param {string[]} chunks
 * @param {string} apiKey
 * @returns {Promise<{data: {embedding: number[]}[], error?: {message: string, type: string}}>}
 */
export async function fetchEmbeddings(chunks, apiKey) {
  const NUM_RETRIES = 100;
  const INIT_RETRY_MS = 50;
  for (let i = 0; i <= NUM_RETRIES; i++) {
    const res = await fetch(`${OPENAI_BASE}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: chunks,
      }),
    });
    if ((res.status < 500 && res.status !== 429) || i === NUM_RETRIES) {
      return res.json();
    }
    // Exponential backoff with full jitter
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * INIT_RETRY_MS * Math.pow(2, i))
    );
  }
  // Should never reach here – last loop iteration should return
  throw new Error("An unknown error occurred");
}
