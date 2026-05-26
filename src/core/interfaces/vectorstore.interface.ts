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

export interface IVectorStoreService {
  /**
   * Initializes or gets a collection in the Vector DB (ChromaDB).
   */
  initializeCollection(collectionName: string): Promise<void>;

  /**
   * Stores chunks with their vector embeddings and metadata in ChromaDB.
   */
  addDocuments(
    collectionName: string,
    documents: VectorDocument[]
  ): Promise<void>;

  /**
   * Performs vector similarity search on a collection filtering by metadata.
   */
  search(
    collectionName: string,
    queryEmbedding: number[],
    filter: Record<string, any>,
    limit?: number
  ): Promise<VectorSearchResult[]>;
}
