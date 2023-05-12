/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */


export interface paths {
  "/query": {
    /**
     * Query 
     * @description Accepts search query objects array each with query and optional filter. Break down complex questions into sub-questions. Refine results by criteria, e.g. time / source, don't do this often. Split queries if ResponseTooLargeError occurs.
     */
    post: operations["query_query_post"];
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    /** DocumentChunkMetadata */
    DocumentChunkMetadata: {
      source?: components["schemas"]["Source"];
      /** Source Id */
      source_id?: string;
      /** Url */
      url?: string;
      /** Created At */
      created_at?: string;
      /** Author */
      author?: string;
      /** Document Id */
      document_id?: string;
    };
    /** DocumentChunkWithScore */
    DocumentChunkWithScore: {
      /** Id */
      id?: string;
      /** Text */
      text: string;
      metadata: components["schemas"]["DocumentChunkMetadata"];
      /** Embedding */
      embedding?: (number)[];
      /** Score */
      score: number;
    };
    /** DocumentMetadataFilter */
    DocumentMetadataFilter: {
      /** Document Id */
      document_id?: string;
      source?: components["schemas"]["Source"];
      /** Source Id */
      source_id?: string;
      /** Author */
      author?: string;
      /** Start Date */
      start_date?: string;
      /** End Date */
      end_date?: string;
    };
    /** HTTPValidationError */
    HTTPValidationError: {
      /** Detail */
      detail?: (components["schemas"]["ValidationError"])[];
    };
    /** Query */
    Query: {
      /** Query */
      query: string;
      filter?: components["schemas"]["DocumentMetadataFilter"];
      /**
       * Top K 
       * @default 3
       */
      top_k?: number;
    };
    /** QueryRequest */
    QueryRequest: {
      /** Queries */
      queries: (components["schemas"]["Query"])[];
    };
    /** QueryResponse */
    QueryResponse: {
      /** Results */
      results: (components["schemas"]["QueryResult"])[];
    };
    /** QueryResult */
    QueryResult: {
      /** Query */
      query: string;
      /** Results */
      results: (components["schemas"]["DocumentChunkWithScore"])[];
    };
    /**
     * Source 
     * @description An enumeration. 
     * @enum {string}
     */
    Source: "email" | "file" | "chat";
    /** ValidationError */
    ValidationError: {
      /** Location */
      loc: (string | number)[];
      /** Message */
      msg: string;
      /** Error Type */
      type: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type external = Record<string, never>;

export interface operations {

  /**
   * Query 
   * @description Accepts search query objects array each with query and optional filter. Break down complex questions into sub-questions. Refine results by criteria, e.g. time / source, don't do this often. Split queries if ResponseTooLargeError occurs.
   */
  query_query_post: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["QueryRequest"];
      };
    };
    responses: {
      /** @description Successful Response */
      200: {
        content: {
          "application/json": components["schemas"]["QueryResponse"];
        };
      };
      /** @description Validation Error */
      422: {
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
}