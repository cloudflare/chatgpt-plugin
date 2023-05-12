# Cloudflare Docs Retrieval Plugin

A [ChatGPT Retrieval Plugin](https://github.com/openai/chatgpt-retrieval-plugin)
for querying the [public Cloudflare Documentation](https://developers.cloudflare.com/),
running as a [Worker](https://developers.cloudflare.com/workers/).

Also includes a [scheduled Worker](https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/)
to periodically index the documentation, so the plugin always retrieves up-to-date data.

The documents (markdown files) are converted into [embeddings](https://platform.openai.com/docs/guides/embeddings)
so that relevant text can be retrieved quickly when a query comes through. These embedding vectors are stored in
[KV](https://developers.cloudflare.com/workers/learning/how-kv-works/), Cloudflare's low-latency, key-value data store.

## Overview

You'll need an [OpenAI API Key](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) to run this.
The (optional) scheduler Worker also needs a [token to access GitHub's GraphQL API](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#authenticating-with-a-personal-access-token-classic),
and [Queues enabled on the Cloudflare account](https://developers.cloudflare.com/queues/).

The plugin Worker responds to the `/query` endpoint – as well as returning the JSON manifests needed for the plugin.

When a query comes in, the Worker will use the OpenAI API to convert the text into an embedding vector, and then
compare that with the stored embeddings created from the documentation, to find the most relevant documents to return.
ChatGPT will use these documents to inform its answer to the user's question.

## Plugin Worker

Configuration can be found in `plugin/wrangler.toml`

### Running locally

Create a preview KV namespace:

```
npx wrangler kv:namespace create retrieval --preview
```

Then update the `preview_id` in `plugin/wrangler.toml` – leave the `binding` name as-is

Create a `.dev.vars` file in the `plugin` directory containing:

```
OPENAI_API_KEY="sk-..."
```

Then:

```
npm run dev
```

### Deploying

```
npx wrangler kv:namespace create retrieval
```

Then update the KV `id` (under `[[kv_namespaces]]`) in `plugin/wrangler.toml` – leave the `binding` name as-is

```
npx wrangler secret put OPENAI_API_KEY
```

Finally:

```
npm run deploy
```

## Refreshing the embeddings manually

```
OPENAI_API_KEY="sk-..." KV_NAMESPACE_ID="d03..." npm run refresh
```

## Scheduler Worker (optional)

Configuration can be found in `scheduler/wrangler.toml`

### Running locally

If you haven't already:

```
npx wrangler kv:namespace create retrieval --preview
```

Then update the `preview_id` in `scheduler/wrangler.toml` – leave the `binding` name as-is

Create a `.dev.vars` file in the `scheduler` directory containing:

```
OPENAI_API_KEY="sk-..."
GITHUB_API_KEY="ghp_..."
```

Then:

```
npm run dev:scheduler
```

### Deploying

```
npx wrangler queues create embeddings-resolver
```

```
npx wrangler kv:namespace create retrieval
```

Then update the KV `id` (under `[[kv_namespaces]]`) in `scheduler/wrangler.toml` – leave the `binding` name as-is

```
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GITHUB_API_KEY
```

Finally:

```
npm run deploy:scheduler
```
