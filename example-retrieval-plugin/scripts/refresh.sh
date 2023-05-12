#!/bin/bash -ex

# export CLOUDFLARE_ACCOUNT_ID=3b2...
# export KV_NAMESPACE_ID=d03...
# export OPENAI_API_KEY=sk-...

# Crawl .md docs and create chunks
node chunk.js

# Generate embeddings json/bin
node embeddings.js

# Uploading chunks to KV
npx wrangler kv:bulk put chunks.bulk.json --namespace-id=$KV_NAMESPACE_ID

# Uploading embeddings.bin to KV
npx wrangler kv:key put embeddings:v1 --path embeddings.bin --namespace-id=$KV_NAMESPACE_ID
