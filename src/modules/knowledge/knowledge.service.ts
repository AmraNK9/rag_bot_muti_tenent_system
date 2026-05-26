import { IEmbeddingService } from '../../core/interfaces/embedding.interface';
import { IVectorStoreService, VectorDocument } from '../../core/interfaces/vectorstore.interface';
import { chunkMyanmarText } from './myanmar-chunker';
import { ChatBot } from '../../infrastructure/db/models';

export class KnowledgeService {
  constructor(
    private embeddingService: IEmbeddingService,
    private vectorStore: IVectorStoreService
  ) {}

  /**
   * Ingests a raw text document, chunks it for Myanmar language, embeds chunks, and stores in ChromaDB.
   */
  async ingestDocument(params: {
    chatbotId: number;
    businessId: number;
    documentText: string;
    maxChunkSize?: number;
    overlap?: number;
  }): Promise<{ chunkCount: number }> {
    const { chatbotId, businessId, documentText, maxChunkSize = 500, overlap = 50 } = params;

    // 1. Verify chatbot and business relationship using Sequelize
    const chatbot = await ChatBot.findOne({
      where: {
        id: chatbotId,
        business_id: businessId,
      },
    });
    if (!chatbot) {
      throw new Error(`ChatBot with ID ${chatbotId} does not belong to Business ${businessId} or does not exist.`);
    }

    // 2. Chunk text using Myanmar-optimized chunker
    const chunks = chunkMyanmarText(documentText, maxChunkSize, overlap);
    if (chunks.length === 0) {
      return { chunkCount: 0 };
    }

    // 3. Call Voyage AI Service to generate embeddings
    const embeddings = await this.embeddingService.embedDocuments(chunks);

    // 4. Transform into vector records
    const vectorDocs: VectorDocument[] = chunks.map((chunk, index) => ({
      id: `chatbot_${chatbotId}_chunk_${Date.now()}_${index}`,
      text: chunk,
      embedding: embeddings[index],
      metadata: {
        chatbot_id: chatbotId,
        business_id: businessId,
      },
    }));

    // 5. Save in ChromaDB under the business collection
    const collectionName = `business_${businessId}`;
    await this.vectorStore.addDocuments(collectionName, vectorDocs);

    return { chunkCount: chunks.length };
  }
}
