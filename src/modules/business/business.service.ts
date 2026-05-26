import { Business, ChatBot } from '../../infrastructure/db/models';
import { IVectorStoreService } from '../../core/interfaces/vectorstore.interface';

export class BusinessService {
  constructor(private vectorStore: IVectorStoreService) {}

  /**
   * Registers a new Business profile in the DB.
   */
  async signupBusiness(name: string, detailInfo: string) {
    try {
      const business = await Business.create({
        name,
        detail_info: detailInfo,
      });
      return business;
    } catch (error) {
      console.error('Failed to signup business profile:', error);
      throw new Error(`Business signup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a new ChatBot for a Business and configures ChromaDB vector collection.
   */
  async createChatBot(params: {
    businessId: number;
    name: string;
    token: string;
    apiId?: string;
    apiHash?: string;
    type: 'telegram' | 'facebook';
  }) {
    try {
      // 1. Verify business exists
      const business = await Business.findByPk(params.businessId);
      if (!business) {
        throw new Error(`Business with ID ${params.businessId} not found`);
      }

      // 2. Insert ChatBot details into the database
      const chatbot = await ChatBot.create({
        business_id: params.businessId,
        name: params.name,
        token: params.token,
        api_id: params.apiId || null,
        api_hash: params.apiHash || null,
        type: params.type,
      });

      // 3. Initialize/reuse a vector collection in ChromaDB based on the business_id
      const collectionName = `business_${params.businessId}`;
      await this.vectorStore.initializeCollection(collectionName);

      return chatbot;
    } catch (error) {
      console.error('Failed to create ChatBot onboarding:', error);
      throw new Error(`ChatBot onboarding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
