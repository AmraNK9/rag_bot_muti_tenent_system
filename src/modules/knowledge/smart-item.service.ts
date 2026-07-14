import { Op } from 'sequelize';
import { IEmbeddingService } from '../../core/interfaces/embedding.interface';
import { IVectorStoreService, VectorDocument } from '../../core/interfaces/vectorstore.interface';
import { KnowledgeAsset, ChatBot } from '../../infrastructure/db/models';

export class SmartItemService {
  constructor(
    private embeddingService: IEmbeddingService,
    private vectorStore: IVectorStoreService
  ) {}

  private generateSemanticText(item: any): string {
    let text = `[${item.item_type.toUpperCase()}] ${item.title}\n\n${item.content}`;
    if (item.item_type === 'product') {
      text += `\n\nPrice: ${item.price !== null ? item.price : 'N/A'}`;
      if (item.auto_track_stock) {
        text += `\nStock: ${item.stock_count !== null ? item.stock_count : 'N/A'}`;
      }
    }
    return text;
  }

  async createSmartItem(chatbotId: number, data: {
    item_type: 'product' | 'info';
    title: string;
    content: string;
    price?: number | null;
    stock_count?: number | null;
    auto_track_stock?: boolean;
  }) {
    // 1. Check if chatbot exists and get businessId
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) throw new Error('Chatbot not found');
    const businessId = chatbot.business_id;

    // 2. Save structured data to DB
    const asset = await KnowledgeAsset.create({
      tenant_id: chatbotId,
      item_type: data.item_type,
      title: data.title,
      content: data.content,
      price: data.price || null,
      stock_count: data.stock_count || null,
      auto_track_stock: data.auto_track_stock || false,
    });

    // 3. Generate Semantic Text & Embedding
    const semanticText = this.generateSemanticText(asset);
    const [embedding] = await this.embeddingService.embedDocuments([semanticText]);

    // 4. Sync with PgVector (knowledge_embeddings table) for global RAG search
    const vectorDoc: VectorDocument = {
      id: `smartitem_${asset.id}`,
      text: semanticText,
      embedding: embedding,
      metadata: {
        chatbot_id: chatbotId,
        business_id: businessId,
        type: 'smart_item',
      },
    };
    await this.vectorStore.addDocuments(`business_${businessId}`, [vectorDoc]);

    return asset;
  }

  async updateSmartItem(chatbotId: number, assetId: number, data: {
    item_type?: 'product' | 'info';
    title?: string;
    content?: string;
    price?: number | null;
    stock_count?: number | null;
    auto_track_stock?: boolean;
  }) {
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) throw new Error('Chatbot not found');
    const businessId = chatbot.business_id;

    const asset = await KnowledgeAsset.findOne({ where: { id: assetId, tenant_id: chatbotId } });
    if (!asset) throw new Error('Smart Item not found');

    // Update fields
    if (data.item_type) asset.item_type = data.item_type;
    if (data.title) asset.title = data.title;
    if (data.content) asset.content = data.content;
    if (data.price !== undefined) asset.price = data.price;
    if (data.stock_count !== undefined) asset.stock_count = data.stock_count;
    if (data.auto_track_stock !== undefined) asset.auto_track_stock = data.auto_track_stock;

    const semanticText = this.generateSemanticText(asset);
    const [embedding] = await this.embeddingService.embedDocuments([semanticText]);

    // Sync with PgVector
    const vectorDoc: VectorDocument = {
      id: `smartitem_${asset.id}`,
      text: semanticText,
      embedding: embedding,
      metadata: {
        chatbot_id: chatbotId,
        business_id: businessId,
        type: 'smart_item',
      },
    };
    await this.vectorStore.addDocuments(`business_${businessId}`, [vectorDoc]);

    return asset;
  }

  async deleteSmartItem(chatbotId: number, assetId: number) {
    const chatbot = await ChatBot.findByPk(chatbotId);
    if (!chatbot) throw new Error('Chatbot not found');
    
    const asset = await KnowledgeAsset.findOne({ where: { id: assetId, tenant_id: chatbotId } });
    if (!asset) throw new Error('Smart Item not found');

    await asset.destroy();

    // Remove from PgVector
    await this.vectorStore.deleteDocument(`smartitem_${assetId}`);
    return true;
  }

  async getSmartItems(
    chatbotId: number,
    limit: number = 20,
    offset: number = 0,
    search?: string,
    itemType?: 'product' | 'info'
  ) {
    const where: Record<string, any> = { tenant_id: chatbotId };

    if (itemType) {
      where['item_type'] = itemType;
    }

    if (search && search.trim()) {
      where[Op.or as any] = [
        { title: { [Op.iLike]: `%${search.trim()}%` } },
        { content: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const { count, rows } = await KnowledgeAsset.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      attributes: { exclude: ['embedding'] },
    });

    return {
      items: rows,
      total: count,
    };
  }
}
