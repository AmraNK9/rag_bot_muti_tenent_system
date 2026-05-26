import { ILLMService, ChatMessage } from '../../core/interfaces/llm.interface';
import { IEmbeddingService } from '../../core/interfaces/embedding.interface';
import { IVectorStoreService } from '../../core/interfaces/vectorstore.interface';
import { IToolCallingRegistry } from '../../core/interfaces/tool.interface';
import { ISystemPromptFactory } from '../../core/interfaces/prompt.interface';
import { ChatBot, Business } from '../../infrastructure/db/models';
import { ChatMemoryService } from './chat-memory.service';

export class RetrievalGenerationService {
  constructor(
    private llmService: ILLMService,
    private embeddingService: IEmbeddingService,
    private vectorStore: IVectorStoreService,
    private toolRegistry: IToolCallingRegistry,
    private promptFactory: ISystemPromptFactory,
    private chatMemoryService: ChatMemoryService
  ) {}

  /**
   * Main flow: Keyword extraction -> Hybrid Search -> Context Aggregation -> Generation
   */
  async generateResponse(params: {
    chatbotId: number;
    senderId: number;
    userMessage: string;
  }): Promise<string> {
    const { chatbotId, senderId, userMessage } = params;

    // 1. Fetch ChatBot and associated Business using Sequelize joins
    const chatbot = await ChatBot.findOne({
      where: { id: chatbotId },
      include: [{ model: Business, as: 'business' }],
    });
    if (!chatbot || !chatbot.business) {
      throw new Error(`ChatBot with ID ${chatbotId} or its associated Business profile was not found.`);
    }

    // 2. Query Extraction: trigger DeepSeek tool calling to extract keywords
    const extractionTool = this.toolRegistry.getTool('QueryExtractionTool');
    let extractedKeywords: string[] = [];

    if (extractionTool) {
      const toolResult = await this.llmService.executeToolCalling(
        [{ role: 'user', content: userMessage }],
        [extractionTool.definition]
      );
      if (toolResult && toolResult.toolName === 'QueryExtractionTool') {
        const executed = await extractionTool.execute(toolResult.arguments);
        extractedKeywords = executed.exact_keywords || [];
      }
    }

    // 3. Search: Perform Hybrid Search in ChromaDB
    const retrievedDocs = await this.hybridSearch({
      chatbotId,
      businessId: chatbot.business_id,
      query: userMessage,
      keywords: extractedKeywords,
      limit: 3,
    });

    const contextText = retrievedDocs.map(doc => doc.text).join('\n---\n');

    // 4. Prompt Strategy: Build standard system prompt
    const systemPrompt = this.promptFactory.getPrompt(chatbot.type, {
      botName: chatbot.name,
      businessName: chatbot.business.name,
      businessDetailInfo: chatbot.business.detail_info,
      botType: chatbot.type,
    });

    // 5. Memory Management: Fetch context (last 10 messages + summary)
    const { summary, recentMessages } = await this.chatMemoryService.getContextForChat(
      chatbotId,
      senderId
    );

    // 6. Build final messages payload
    const messagesPayload: ChatMessage[] = [];

    // Prepend system prompt loaded with RAG context
    let finalSystemPrompt = systemPrompt;
    if (contextText) {
      finalSystemPrompt += `\n\n[Context: Verified Business facts. Use ONLY this information to respond if applicable]:\n${contextText}`;
    }
    messagesPayload.push({ role: 'system', content: finalSystemPrompt });

    // Inject history summary if exists
    if (summary) {
      messagesPayload.push({
        role: 'system',
        content: `[Summary of conversation history up to this point: ${summary}]`,
      });
    }

    // Append last 10 messages
    for (const msg of recentMessages) {
      messagesPayload.push({
        role: msg.sender_id === senderId ? 'user' : 'assistant',
        content: msg.message,
      });
    }

    // Generate reply using DeepSeek
    const botReply = await this.llmService.generateCompletion(messagesPayload);

    return botReply;
  }

  /**
   * Implements Hybrid Search fusing keyword overlap (30%) and vector similarity (70%).
   */
  async hybridSearch(params: {
    chatbotId: number;
    businessId: number;
    query: string;
    keywords: string[];
    limit: number;
  }) {
    const { chatbotId, businessId, query, keywords, limit } = params;
    const collectionName = `business_${businessId}`;

    // A. Vector Search Part
    const queryEmbedding = await this.embeddingService.embedQuery(query);
    const vectorCandidates = await this.vectorStore.search(
      collectionName,
      queryEmbedding,
      { chatbot_id: chatbotId },
      limit * 3 // Over-retrieve for ranking
    );

    // B. Word Match & Fusion Ranking
    const rankedResults = vectorCandidates.map(candidate => {
      const wordMatchScore = this.calculateWordMatchScore(candidate.text, keywords);

      // ChromaDB returns distance (lower is closer/better).
      // Translate distance score to a similarity metric in range [0, 1].
      // For L2 distance, similarity ~ 1 / (1 + distance).
      // For cosine distance, similarity ~ 1 - distance.
      const similarity = candidate.score >= 0 && candidate.score <= 1
        ? 1 - candidate.score
        : 1 / (1 + Math.abs(candidate.score));

      // 30% Keyword Matching + 70% Semantic Embedding Similarity
      const hybridScore = 0.3 * wordMatchScore + 0.7 * similarity;

      return {
        ...candidate,
        wordMatchScore,
        similarity,
        hybridScore,
      };
    });

    // Sort by descending hybrid score
    return rankedResults
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);
  }

  private calculateWordMatchScore(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 0;
    
    let matches = 0;
    const lowerText = text.toLowerCase();

    for (const kw of keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        matches++;
      }
    }

    return matches / keywords.length;
  }
}
