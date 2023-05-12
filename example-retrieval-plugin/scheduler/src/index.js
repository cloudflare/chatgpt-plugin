import { VectorCollection } from "../../shared/vector.js";
import {
  OWNER,
  REPO_NAME,
  FULL_DIRS,
  textToChunks,
  fetchChunkEmbeddings,
  oidPrefix,
} from "../../shared/docs.js";
import { fetchMdFiles, fetchFileContents } from "../../shared/github.js";

const EMBEDDINGS_KEY = "embeddings:v1";

/** @type {ExportedHandler<Env, EmbeddingMessage>} */
export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(scheduleEmbeddings(env, ctx));
    console.log("scheduled ok");
  },

  async queue(batch, env, ctx) {
    const files = batch.messages.map((m) => m.body);

    const jobId = files[0]?.jobId;
    const batchId = files[0]?.oid;

    if (jobId == null || batchId == null) {
      return;
    }

    try {
      console.log("fetching file contents");

      const filesWithContents = await fetchFileContents(
        env.GITHUB_API_KEY,
        OWNER,
        REPO_NAME,
        files
      );

      const chunks = filesWithContents
        .map(({ path, oid, text }) => textToChunks(path, oid, text))
        .flat();

      const kvPromises = chunks.map((chunk) =>
        env.KV.put(`chunk:${chunk.id}`, JSON.stringify(chunk))
      );

      console.log("fetching chunk embeddings");

      const chunkEmbeddings = await fetchChunkEmbeddings(
        env.OPENAI_API_KEY,
        chunks
      );

      const vectorCollection = VectorCollection.from(chunkEmbeddings);

      console.log(
        "batch embeddings byteLength:",
        vectorCollection.buffer.byteLength
      );

      kvPromises.push(
        env.KV.put(
          `job:${jobId}:embeddings:${batchId}`,
          vectorCollection.buffer
        )
      );

      await Promise.all(kvPromises);
    } catch (e) {
      console.error(e);
    }

    await postJobMessage(env.JOB_STORE, {
      action: "batchProcessed",
      jobId,
      batchId,
      batchSize: files.length,
    });

    console.log("queue processed ok:", files.length);
  },
};

/**
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
async function scheduleEmbeddings(env, ctx) {
  console.log("fetching existing and md files");

  const [existingEmbeddings, mdFiles] = await Promise.all([
    env.KV.get(EMBEDDINGS_KEY, "arrayBuffer"),
    fetchMdFiles(env.GITHUB_API_KEY, OWNER, REPO_NAME, FULL_DIRS),
  ]);

  const vectors = new VectorCollection(existingEmbeddings);

  const { newMdFiles, deletedChunkIds } = filterOutExisting(
    mdFiles,
    vectors.idStrs()
  );

  const jobId = Date.now();

  await postJobMessage(env.JOB_STORE, {
    action: "initJob",
    jobId,
    numFiles: newMdFiles.length,
    deletedChunkIds,
  });

  const BATCH_SIZE = 100;
  for (let i = 0; i < newMdFiles.length; i += 100) {
    const mdFilesBatch = newMdFiles.slice(i, i + BATCH_SIZE);
    const queueMessages = mdFilesBatch.map((entry) => ({
      body: { jobId, ...entry },
    }));
    console.log("sending batch");
    await env.RESOLVER_QUEUE.sendBatch(queueMessages);
  }
}

/**
 * @param {DurableObjectNamespace} jobStore
 * @param {JobMessage} message
 */
async function postJobMessage(jobStore, message) {
  const stub = jobStore.get(jobStore.idFromName("v1"));
  const res = await stub.fetch("http://do", {
    method: "POST",
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    console.error(res.status);
    console.error(res.headers);
    console.error(await res.text());
  }
}

/** @implements {DurableObject} */
export class JobStore {
  /**
   * @param {DurableObjectState} state
   * @param {Env} env
   */
  constructor(state, env) {
    this.state = state;
    this.kv = env.KV;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  async fetch(request) {
    const { storage } = this.state;

    /** @type {JobMessage} */
    const message = await request.json();
    const { action, jobId } = message;
    const remainingKey = `job:${jobId}:remaining`;
    const deletedKey = `job:${jobId}:deletedIds`;
    const batchesKey = `job:${jobId}:batchIds`;

    if (action === "initJob") {
      storage.put(remainingKey, message.numFiles);
      storage.put(deletedKey, new Set(message.deletedChunkIds));
      storage.put(batchesKey, []);
    } else if (action === "batchProcessed") {
      /** @type {Map<string, any>} */
      const records = await storage.get([remainingKey, batchesKey]);

      let remaining = Number(records.get(remainingKey));
      remaining = Math.max(remaining - message.batchSize, 0);
      storage.put(remainingKey, remaining);

      /** @type {string[]} */
      const batchIds = records.get(batchesKey) ?? [];
      batchIds.push(message.batchId);
      storage.put(batchesKey, batchIds);

      if (remaining === 0) {
        await this.finishJob(jobId, batchIds);
      }
    }
    return new Response(null, { status: 204 });
  }

  /**
   * @param {number} jobId
   * @param {string[]} batchIds
   */
  async finishJob(jobId, batchIds) {
    const { storage } = this.state;
    const deletedKey = `job:${jobId}:deletedIds`;

    // Just a precaution to ensure all KV writes have finished
    await scheduler.wait(1000);

    console.log("fetching existing");

    const [existingEmbeddingsBuffer, newEmbeddingBuffers, deletedIdsOrNull] =
      await Promise.all([
        this.kv.get(EMBEDDINGS_KEY, "arrayBuffer"),
        Promise.all(
          batchIds.map((batchId) =>
            this.kv.get(`job:${jobId}:embeddings:${batchId}`, "arrayBuffer")
          )
        ),
        /** @type {Promise<Set<string> | null>} */
        (storage.get(deletedKey)),
      ]);

    const existingEmbeddings = new VectorCollection(existingEmbeddingsBuffer);

    const batchVectors = newEmbeddingBuffers.map(
      (buffer) => new VectorCollection(buffer)
    );

    const deletedIds = deletedIdsOrNull ?? new Set();

    console.log("merging");

    const joinedVectors = VectorCollection.merge(
      batchVectors,
      existingEmbeddings,
      deletedIds
    );

    console.log(
      "saving embeddings, byteLength:",
      joinedVectors.buffer.byteLength
    );

    await this.kv.put(EMBEDDINGS_KEY, joinedVectors.buffer);

    console.log("cleaning up");

    try {
      await this.cleanupJob(jobId, batchIds, deletedIds);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * @param {number} jobId
   * @param {string[]} batchIds
   * @param {Set<string>} deletedIds
   */
  async cleanupJob(jobId, batchIds, deletedIds) {
    const { storage } = this.state;
    const remainingKey = `job:${jobId}:remaining`;
    const deletedKey = `job:${jobId}:deletedIds`;
    const batchesKey = `job:${jobId}:batchIds`;

    // Clean up job storage
    await storage.delete([remainingKey, deletedKey, batchesKey]);
    await Promise.all(
      batchIds.map((batchId) =>
        this.kv.delete(`job:${jobId}:embeddings:${batchId}`)
      )
    );

    await Promise.all(
      [...deletedIds].map((id) => this.kvExpire(`chunk:${id}`, 10 * 60)) // keep old chunks around for ten minutes
    );
  }

  /**
   * @param {string} key
   * @param {number} expirationTtl
   */
  async kvExpire(key, expirationTtl) {
    const val = await this.kv.get(key, "arrayBuffer");
    return val && this.kv.put(key, val, { expirationTtl });
  }
}

/**
 * @param {{path: string, oid: string}[]} mdFiles
 * @param {Iterable<string>} existingIds
 */
function filterOutExisting(mdFiles, existingIds) {
  const existingOidPrefixes = new Map(
    [...existingIds].map((oid) => [oidPrefix(oid), oid])
  );

  const newMdFiles = mdFiles.filter(
    ({ oid }) => !existingOidPrefixes.delete(oidPrefix(oid))
  );

  const deletedChunkIds = [...existingOidPrefixes.values()];

  return { newMdFiles, deletedChunkIds };
}
