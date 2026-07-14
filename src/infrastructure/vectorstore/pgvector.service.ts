import { Pool } from 'pg';
import { IVectorStoreService, VectorDocument, VectorSearchResult, KnowledgeChunk } from '../../core/interfaces/vectorstore.interface';
import { debugLogger } from '../../core/logger';

declare const process: {
  env: {
    DATABASE_URL?: string;
  };
};

/**
 * PgVectorStoreService
 *
 * Implements IVectorStoreService using PostgreSQL + pgvector extension.
 * Replaces the previous ChromaDB-based implementation.
 *
 * Vector data is stored in the `knowledge_embeddings` table within the
 * same PostgreSQL database as the rest of the application, eliminating
 * the need for a separate ChromaDB server process.
 *
 * Embedding dimension: 1024 (Voyage AI default)
 */
export class PgVectorStoreService implements IVectorStoreService {
  private pool: Pool;
  private initialized = false;
  private readonly EMBEDDING_DIM = 1024;

  constructor(connectionString?: string) {
    const connStr = connectionString || process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL is required for PgVectorStoreService.');
    }
    this.pool = new Pool({ connectionString: connStr });
  }

  /**
   * Ensures the knowledge_embeddings table and ivfflat index exist.
   * Called lazily on first use (or explicitly via initializeCollection).
   */
  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;

    const client = await this.pool.connect();
    try {
      // Enable pgvector extension (idempotent)
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

      // Create the unified embeddings table for all collections/businesses
      await client.query(`
        CREATE TABLE IF NOT EXISTS knowledge_embeddings (
          id          SERIAL PRIMARY KEY,
          doc_id      TEXT NOT NULL UNIQUE,
          collection  TEXT NOT NULL,
          text        TEXT NOT NULL,
          metadata    JSONB DEFAULT '{}',
          embedding   vector(${this.EMBEDDING_DIM})
        );
      `);

      // IVFFlat index for approximate cosine similarity search
      // lists=100 is a good starting point; tune based on dataset size
      await client.query(`
        CREATE INDEX IF NOT EXISTS knowledge_embeddings_embedding_idx
        ON knowledge_embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);

      // Index on collection for fast filtered lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS knowledge_embeddings_collection_idx
        ON knowledge_embeddings (collection);
      `);

      this.initialized = true;
      console.log('    PgVectorStoreService: knowledge_embeddings table & index ready.');
    } finally {
      client.release();
    }
  }

  /**
   * Initializes (ensures) the schema. In pgvector, there is no concept of
   * separate collections — all data lives in one table filtered by the
   * `collection` column.
   */
  async initializeCollection(collectionName: string): Promise<void> {
    await this.ensureSchema();
    debugLogger.log('VECTOR_STORE', `Collection ready (pgvector): ${collectionName}`);
  }

  /**
   * Inserts or updates vector documents in the knowledge_embeddings table.
   * Uses ON CONFLICT (doc_id) DO UPDATE to handle re-ingestion gracefully.
   */
  async addDocuments(collectionName: string, documents: VectorDocument[]): Promise<void> {
    await this.ensureSchema();

    if (documents.length === 0) return;

    const client = await this.pool.connect();
    try {
      // Batch upsert using a single prepared statement per document
      for (const doc of documents) {
        const embeddingStr = `[${doc.embedding.join(',')}]`;
        await client.query(
          `INSERT INTO knowledge_embeddings (doc_id, collection, text, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5::vector)
           ON CONFLICT (doc_id)
           DO UPDATE SET
             collection = EXCLUDED.collection,
             text       = EXCLUDED.text,
             metadata   = EXCLUDED.metadata,
             embedding  = EXCLUDED.embedding;`,
          [
            doc.id,
            collectionName,
            doc.text,
            JSON.stringify(doc.metadata),
            embeddingStr,
          ]
        );
      }
      debugLogger.log('VECTOR_STORE', `Upserted ${documents.length} docs into collection: ${collectionName}`);
    } finally {
      client.release();
    }
  }

  /**
   * Performs cosine similarity vector search within a collection, optionally
   * filtered by metadata key-value pairs.
   *
   * Returns results ordered by similarity (highest first).
   * pgvector's <=> operator computes cosine distance (lower = more similar),
   * so similarity score = 1 - distance.
   */
  async search(
    collectionName: string,
    queryEmbedding: number[],
    filter: Record<string, any>,
    limit = 3
  ): Promise<VectorSearchResult[]> {
    await this.ensureSchema();

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build dynamic WHERE clause for metadata filters
    const conditions: string[] = ['collection = $1'];
    const params: any[] = [collectionName, embeddingStr, limit];

    let paramIndex = 4; // $1=collection, $2=embedding, $3=limit
    for (const [key, value] of Object.entries(filter)) {
      conditions.push(`metadata->>'${key}' = $${paramIndex}`);
      params.push(String(value));
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    debugLogger.log(
      'VECTOR_SEARCH',
      `Searching pgvector collection: ${collectionName} | filter: ${JSON.stringify(filter)} | limit: ${limit}`
    );

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT
           doc_id,
           text,
           metadata,
           1 - (embedding <=> $2::vector) AS similarity_score
         FROM knowledge_embeddings
         WHERE ${whereClause}
         ORDER BY embedding <=> $2::vector
         LIMIT $3;`,
        params
      );

      const searchResults: VectorSearchResult[] = result.rows.map((row: {
        doc_id: string;
        text: string;
        metadata: Record<string, any> | string;
        similarity_score: string;
      }) => ({
        id: row.doc_id,
        text: row.text,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        score: parseFloat(row.similarity_score),
      }));

      debugLogger.log('VECTOR_SEARCH', `pgvector search results for: ${collectionName}`, searchResults);
      return searchResults;
    } finally {
      client.release();
    }
  }

  /**
   * Lists knowledge chunks for a collection with pagination.
   */
  async listDocuments(
    collectionName: string,
    limit = 20,
    offset = 0
  ): Promise<{ chunks: KnowledgeChunk[]; total: number }> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      const countResult = await client.query(
        `SELECT COUNT(*) FROM knowledge_embeddings WHERE collection = $1;`,
        [collectionName]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await client.query(
        `SELECT doc_id, collection, text, metadata
         FROM knowledge_embeddings
         WHERE collection = $1
         ORDER BY id ASC
         LIMIT $2 OFFSET $3;`,
        [collectionName, limit, offset]
      );

      const chunks: KnowledgeChunk[] = result.rows.map((row: {
        doc_id: string;
        collection: string;
        text: string;
        metadata: Record<string, any> | string;
      }) => ({
        id: row.doc_id,
        collection: row.collection,
        text: row.text,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      }));

      return { chunks, total };
    } finally {
      client.release();
    }
  }

  /**
   * Deletes a single knowledge chunk by its doc_id.
   */
  async deleteDocument(docId: string): Promise<boolean> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM knowledge_embeddings WHERE doc_id = $1;`,
        [docId]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Deletes all knowledge chunks for a given collection.
   */
  async deleteCollection(collectionName: string): Promise<number> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM knowledge_embeddings WHERE collection = $1;`,
        [collectionName]
      );
      return result.rowCount ?? 0;
    } finally {
      client.release();
    }
  }

  /**
   * Returns the total chunk count for a collection.
   */
  async countDocuments(collectionName: string): Promise<number> {
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT COUNT(*) FROM knowledge_embeddings WHERE collection = $1;`,
        [collectionName]
      );
      return parseInt(result.rows[0].count, 10);
    } finally {
      client.release();
    }
  }

  /**
   * Closes the PostgreSQL connection pool.
   */
  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}
