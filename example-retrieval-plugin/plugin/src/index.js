import { fetchEmbeddings } from "../../shared/openai.js";
import { VectorCollection } from "../../shared/vector.js";
import { pathToUrl } from "../../shared/docs.js";
import aiPluginJson from "./manifests/ai-plugin.json";
import openaiJson from "./manifests/openapi.json";

/**
 * @typedef { import("./manifests/openapi.js").components["schemas"]["QueryRequest"] } QueryRequest
 * @typedef { import("./manifests/openapi.js").components["schemas"]["QueryResponse"] } QueryResponse
 */

/** @type {ExportedHandler<Env>} */
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (e) {
      return Response.json(
        { error: /** @type {Error} */ (e).message },
        { status: 500 }
      );
    }
  },
};

/** @type {ExportedHandlerFetchHandler<Env>} */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? "localhost";

  // Retrieval Plugin manifest
  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/ai-plugin.json"
  ) {
    aiPluginJson.api.url = `https://${host}/.well-known/openapi.json`;
    return Response.json(aiPluginJson);
  }

  // OpenAPI spec
  if (
    request.method === "GET" &&
    url.pathname === "/.well-known/openapi.json"
  ) {
    openaiJson.servers[0].url = `https://${host}`;
    return Response.json(openaiJson);
  }

  // Endpoint that OpenAI hits for the Retrieval Plugin
  if (request.method === "POST" && url.pathname === "/query") {
    const pluginResponse = await retrievalPluginQuery(request, env, ctx);
    return Response.json(pluginResponse);
  }

  return Response.json({ error: "not found" }, { status: 404 });
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @returns {Promise<QueryResponse>}
 */
async function retrievalPluginQuery(request, env, ctx) {
  /** @type {QueryRequest} */
  const { queries } = await request.json();

  let topKs = await Promise.all(
    queries.map(({ query, top_k: topK }) => queryVectorStore(env, query, topK))
  );

  return {
    results: topKs.map((topKResults, ix) => ({
      query: queries[ix].query,
      results: topKResults.map((result) => ({
        id: result.id,
        text: result.text ?? "",
        metadata: {
          source: "file",
          source_id: result.fileId,
          document_id: result.fileId,
          url: pathToUrl(result.filePath),
          //   created_at: "2022-10-10",
          //   author: "doctor jones",
        },
        // embedding: [1.1, 2.2, 3.3],
        score: result.similarity,
      })),
    })),
  };
}

const EMBEDDINGS_KEY = "embeddings:v1";
const EMBEDDINGS_TTL = 10 * 60; // 10 minutes
const CHUNK_TTL = 24 * 60 * 60; // 24 hours

/**
 * @param {Env} env
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<(Chunk & {similarity: number})[]>}
 */
async function queryVectorStore(env, query, topK = 3) {
  const res = await fetchEmbeddings([query], env.OPENAI_API_KEY);
  if (res.error != null) {
    throw new Error(res.error);
  }
  const queryEmbedding = res.data[0].embedding;

  const vectors = new VectorCollection(
    await env.KV.get(EMBEDDINGS_KEY, {
      type: "arrayBuffer",
      cacheTtl: EMBEDDINGS_TTL,
    })
  );

  const topKSimilarities = vectors.topK(queryEmbedding, topK);

  const topKChunks = await Promise.all(
    topKSimilarities.map(
      ({ id }) =>
        /** @type {Promise<Chunk | null>} */ (
          env.KV.get("chunk:" + id, {
            type: "json",
            cacheTtl: CHUNK_TTL,
          })
        )
    )
  );

  return topKChunks.map((chunk, i) => ({
    similarity: Math.min(topKSimilarities[i].similarity, 1),
    ...(chunk ?? { id: "", filePath: "", fileId: "", title: "", text: "" }),
  }));
}
