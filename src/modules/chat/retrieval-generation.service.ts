import { ILLMService, ChatMessage } from '../../core/interfaces/llm.interface';
import { IEmbeddingService } from '../../core/interfaces/embedding.interface';
import { IVectorStoreService } from '../../core/interfaces/vectorstore.interface';
import { IToolCallingRegistry } from '../../core/interfaces/tool.interface';
import { ISystemPromptFactory } from '../../core/interfaces/prompt.interface';
import { ChatBot, Business } from '../../infrastructure/db/models';
import { ChatMemoryService } from './chat-memory.service';
import { LocalKeywordExtractor } from './local-keyword-extractor';

export class RetrievalGenerationService {
  private localExtractor: LocalKeywordExtractor;

  constructor(
    private llmService: ILLMService,
    private embeddingService: IEmbeddingService,
    private vectorStore: IVectorStoreService,
    private toolRegistry: IToolCallingRegistry,
    private promptFactory: ISystemPromptFactory,
    private chatMemoryService: ChatMemoryService,
    private useToolCallingForExtraction: boolean = false
  ) {
    this.localExtractor = new LocalKeywordExtractor();
  }

  /**
   * Main flow: Keyword extraction -> Hybrid Search -> Context Aggregation -> Generation
   * Optimized with parallel execution for independent operations.
   */
  async generateResponse(params: {
    chatbotId: number;
    senderId: string;
    userMessage: string;
  }): Promise<string> {
    const stream = this.generateResponseStream(params);
    let fullResponse = '';
    for await (const chunk of stream) {
      fullResponse += chunk;
    }
    return fullResponse;
  }

  /**
   * Streaming version of generateResponse.
   * Yields text chunks as they arrive from the LLM.
   * Also returns chatbot token via the optional callback for delivery optimization.
   */
  async *generateResponseStream(params: {
    chatbotId: number;
    senderId: string;
    userMessage: string;
  }): AsyncIterable<string> {
    const { chatbotId, senderId, userMessage } = params;

    // ── Phase A: Parallel independent operations ──────────────────────────
    // These three operations have no dependencies on each other.
    const [chatbot, extractedKeywords, memoryContext] = await Promise.all([
      // 1. Fetch ChatBot and associated Business using Sequelize joins
      ChatBot.findOne({
        where: { id: chatbotId },
        include: [{ model: Business, as: 'business' }],
      }),

      // 2. Keyword extraction (local or tool-calling)
      this.extractKeywords(userMessage),

      // 3. Fetch chat memory context (last 10 messages + summary)
      this.chatMemoryService.getContextForChat(chatbotId, senderId),
    ]);

    if (!chatbot || !chatbot.business) {
      throw new Error(`ChatBot with ID ${chatbotId} or its associated Business profile was not found.`);
    }

    // ── Phase B: Hybrid search (depends on Phase A results) ───────────────
    const retrievedDocs = await this.hybridSearch({
      chatbotId,
      businessId: chatbot.business_id,
      query: userMessage,
      keywords: extractedKeywords,
      limit: 3,
    });

    const contextText = retrievedDocs.map(doc => doc.text).join('\n---\n');

    // ── Phase C: Build prompt & stream LLM response ──────────────────────
    // Build system prompt with RAG context
    const systemPrompt = this.promptFactory.getPrompt(chatbot.type, {
      botName: chatbot.name,
      businessName: chatbot.business.name,
      businessDetailInfo: chatbot.business.detail_info,
      botType: chatbot.type,
    });

    let finalSystemPrompt = systemPrompt;
    if (contextText) {
      finalSystemPrompt += `\n\n[Context: Verified Business facts. Use ONLY this information to respond if applicable]:\n${contextText}`;
    }

    // Build messages payload
    const messagesPayload: ChatMessage[] = [];
    messagesPayload.push({ role: 'system', content: finalSystemPrompt });

    // Inject history summary if exists
    const { summary, recentMessages } = memoryContext;
    if (summary) {
      messagesPayload.push({
        role: 'system',
        content: `[Summary of conversation history up to this point: ${summary}]`,
      });
    }

    // Append last 10 messages
    for (const msg of recentMessages) {
      messagesPayload.push({
        role: String(msg.sender_id) === String(senderId) ? 'user' : 'assistant',
        content: msg.message,
      });
    }

    // Stream response from LLM
    yield* this.llmService.generateCompletionStream(messagesPayload);
  }

  /**
   * Extracts keywords using either local extraction (default) or LLM tool calling.
   */
  private async extractKeywords(userMessage: string): Promise<string[]> {
    if (!this.useToolCallingForExtraction) {
      // Local extraction: instant, no API call
      const result = this.localExtractor.extract(userMessage);
      return result.exact_keywords;
    }

    // Tool-calling extraction via LLM
    const extractionTool = this.toolRegistry.getTool('QueryExtractionTool');
    if (extractionTool) {
      const toolResult = await this.llmService.executeToolCalling(
        [{ role: 'user', content: userMessage }],
        [extractionTool.definition]
      );
      if (toolResult && toolResult.toolName === 'QueryExtractionTool') {
        const executed = await extractionTool.execute(toolResult.arguments);
        return executed.exact_keywords || [];
      }
    }

    return [];
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
