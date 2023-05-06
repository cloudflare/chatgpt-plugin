interface Env {
  readonly OPENAI_API_KEY: string; // secret
  readonly GITHUB_API_KEY: string; // secret
  readonly KV: KVNamespace;
  readonly JOB_STORE: DurableObjectNamespace;
  readonly RESOLVER_QUEUE: Queue<EmbeddingMessage>;
}

interface EmbeddingMessage {
  jobId: number;
  path: string; // file path
  oid: string; // git object id (40 char hex hash)
}

interface InitJobMessage {
  action: "initJob";
  jobId: number;
  numFiles: number;
  deletedChunkIds: string[];
}

interface BatchProcessedMessage {
  action: "batchProcessed";
  jobId: number;
  batchId: string;
  batchSize: number;
}

type JobMessage = InitJobMessage | BatchProcessedMessage;
