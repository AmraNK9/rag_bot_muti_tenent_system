import { IVectorStoreService, VectorDocument, VectorSearchResult } from '../../core/interfaces/vectorstore.interface';
import { ChromaClient } from 'chromadb';
declare const process: { env: { CHROMA_URL?: string } };

export class ChromaVectorStoreService implements IVectorStoreService {
  private client: ChromaClient | null = null;
  private path: string;
  // Memory fallback for mock/local execution if chroma is unavailable
  private fallbackDb: Map<string, VectorDocument[]> = new Map();

  constructor(path?: string) {
    this.path = path || process.env.CHROMA_URL || 'http://localhost:8000';
    try {
      this.client = new ChromaClient({ path: this.path });
    } catch (e) {
      console.warn('Could not initialize ChromaClient directly. Fallback memory DB active.');
    }
  }

  async initializeCollection(collectionName: string): Promise<void> {
    const formattedName = this.formatCollectionName(collectionName);
    try {
      if (this.client) {
        await this.client.getOrCreateCollection({
            name: formattedName,
            metadata: {
                // Voyage AI နဲ့ အခြား Text Embeddings တွေအတွက် 'cosine' distance ကို သုံးတာ အတိကျဆုံးပါ
                "hnsw:space":  "cosine", 
                "description": "Knowledge base for chatbot with Voyage 1024 Dims"
            }
        });
        return;
      }
    } catch (e) {
      console.warn(`Chroma initializeCollection failed. Using memory fallback for collection: ${formattedName}`);
    }
    if (!this.fallbackDb.has(formattedName)) {
      this.fallbackDb.set(formattedName, []);
    }
  }

  async addDocuments(collectionName: string, documents: VectorDocument[]): Promise<void> {
    const formattedName = this.formatCollectionName(collectionName);
    try {
      if (this.client) {
        const collection = await this.client.getOrCreateCollection({ name: formattedName });
        await collection.add({
          ids: documents.map(d => d.id),
          embeddings: documents.map(d => d.embedding),
          metadatas: documents.map(d => d.metadata),
          documents: documents.map(d => d.text)
        });
        return;
      }
    } catch (e) {
      console.warn(`Chroma addDocuments failed. Storing documents in memory fallback.`);
    }

    const currentDocs = this.fallbackDb.get(formattedName) || [];
    currentDocs.push(...documents);
    this.fallbackDb.set(formattedName, currentDocs);
  }

  async search(
    collectionName: string,
    queryEmbedding: number[],
    filter: Record<string, any>,
    limit = 5
  ): Promise<VectorSearchResult[]> {
    const formattedName = this.formatCollectionName(collectionName);
    try {
      if (this.client) {
        const collection = await this.client.getOrCreateCollection({ name: formattedName });
        const results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          // where: filter,
          nResults: limit
        });

        const searchResults: VectorSearchResult[] = [];
        if (results.ids && results.ids[0]) {
          for (let i = 0; i < results.ids[0].length; i++) {
            searchResults.push({
              id: results.ids[0][i],
              text: results.documents?.[0]?.[i] || '',
              metadata: results.metadatas?.[0]?.[i] || {},
              score: results.distances?.[0]?.[i] ?? 0
            });
          }
        }
        return searchResults;
      }
    } catch (e) {
      console.warn(`Chroma query failed. Using memory fallback search.`);
    }

    // Memory fallback search
    const docs = this.fallbackDb.get(formattedName) || [];
    const filteredDocs = docs.filter(doc => {
      for (const key in filter) {
        if (doc.metadata[key] !== filter[key]) return false;
      }
      return true;
    });

    const matches = filteredDocs.map(doc => {
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      return {
        id: doc.id,
        text: doc.text,
        metadata: doc.metadata,
        score: similarity
      };
    });

    // Return descending score (highest first)
    return matches.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private formatCollectionName(name: string): string {
    // Chroma requirements: 3-63 chars, alphanumeric or _ or -, starts and ends with alphanumeric
    let formatted = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    if (/^\d+$/.test(formatted)) {
      formatted = `business_id_${formatted}`;
    }
    if (formatted.length < 3) {
      formatted = `${formatted}_col`;
    }
    return formatted.substring(0, 63);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
