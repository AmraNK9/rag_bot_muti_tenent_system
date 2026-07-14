export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  text: string;
  metadata: Record<string, any>;
  score: number; // Distance or similarity score
}

/** Represents a stored knowledge chunk without the embedding vector */
export interface KnowledgeChunk {
  id: string;
  collection: string;
  text: string;
  metadata: Record<string, any>;
}

export interface IVectorStoreService {
  /**
   * Initializes or ensures the vector store schema is ready for the given collection (pgvector).
   */
  initializeCollection(collectionName: string): Promise<void>;

  /**
   * Stores chunks with their vector embeddings and metadata in pgvector (knowledge_embeddings table).
   */
  addDocuments(
    collectionName: string,
    documents: VectorDocument[]
  ): Promise<void>;

  /**
   * Performs vector similarity search filtering by collection and metadata.
   */
  search(
    collectionName: string,
    queryEmbedding: number[],
    filter: Record<string, any>,
    limit?: number
  ): Promise<VectorSearchResult[]>;

  /**
   * Lists knowledge chunks for a collection with pagination.
   */
  listDocuments(
    collectionName: string,
    limit?: number,
    offset?: number
  ): Promise<{ chunks: KnowledgeChunk[]; total: number }>;

  /**
   * Deletes a single knowledge chunk by doc_id.
   */
  deleteDocument(docId: string): Promise<boolean>;

  /**
   * Deletes all knowledge chunks for a collection.
   */
  deleteCollection(collectionName: string): Promise<number>;

  /**
   * Returns total chunk count for a collection.
   */
  countDocuments(collectionName: string): Promise<number>;
}
