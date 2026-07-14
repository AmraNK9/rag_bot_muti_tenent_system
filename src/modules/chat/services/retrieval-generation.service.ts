import { ILLMService, ChatMessage } from '../../../core/interfaces/llm.interface';
import { IEmbeddingService } from '../../../core/interfaces/embedding.interface';
import { IVectorStoreService, VectorSearchResult } from '../../../core/interfaces/vectorstore.interface';
import { IToolCallingRegistry } from '../../../core/interfaces/tool.interface';
import { SystemPromptFactory } from '../../../infrastructure/prompt/prompt.factory';
import { ChatBot, Business, ChatbotUser, Plan } from '../../../infrastructure/db/models';
import { ChatMemoryService } from './chat-memory.service';
import { redisService } from '../../../infrastructure/redis/redis.service';
import { LocalKeywordExtractor } from './local-keyword-extractor';
import { debugLogger } from '../../../core/logger';

/**
 * Minimum cosine similarity threshold for context injection.
 * Results below this are considered irrelevant and won't be sent to the LLM.
 * Cosine similarity range: 0 (orthogonal) to 1 (identical).
 */
const MIN_SIMILARITY_THRESHOLD = 0.35;

export interface SearchResultWithScores extends VectorSearchResult {
  /** Cosine similarity (1 - cosine_distance). Range: [0, 1]. Higher = more similar. */
  similarity: number;
  /** Keyword overlap ratio. Range: [0, 1]. Only populated in hybrid mode. */
  wordMatchScore: number;
  /** Final ranking score. In vector mode = similarity. In hybrid mode = weighted fusion. */
  finalScore: number;
}

  export class RetrievalGenerationService {
  private localExtractor: LocalKeywordExtractor;

  constructor(
    private llmService: ILLMService,
    private embeddingService: IEmbeddingService,
    private vectorStore: IVectorStoreService,
    private toolRegistry: IToolCallingRegistry,
    private promptFactory: SystemPromptFactory,
    private chatMemoryService: ChatMemoryService,
    private useToolCallingForExtraction: boolean = false,
    /** Enable hybrid search (vector + keyword fusion). Default: false (pure vector search). */
    private useHybridSearch: boolean = false
  ) {
    this.localExtractor = new LocalKeywordExtractor();
  }

  /**
   * Fetches the ChatBot, Business, and associated Plan details, caching it in Redis to ensure 0ms latency impact.
   */
  private async getCachedChatbotConfig(chatbotId: number): Promise<any> {
    const cacheKey = `chatbot_config_v2:${chatbotId}`;
    const cached = await redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const chatbot = await ChatBot.findOne({
      where: { id: chatbotId },
      include: [{ model: Business, as: 'business' }],
    });

    if (!chatbot || !chatbot.business) return null;

    // Fetch associated plan if it's a subscription
    let plan = null;
    if (chatbot.business.plan_id) {
      plan = await Plan.findOne({ where: { id: chatbot.business.plan_id } });
    }

    const configData = {
      ...chatbot.toJSON(),
      business: {
        ...chatbot.business.toJSON(),
        plan: plan ? plan.toJSON() : null
      }
    };

    // Cache for 1 hour
    await redisService.set(cacheKey, JSON.stringify(configData), { EX: 3600 });
    return configData;
  }

  /**
   * Main flow: Vector/Hybrid Search -> Context Aggregation -> Generation
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
   */
  async *generateResponseStream(params: {
    chatbotId: number;
    senderId: string;
    userMessage: string;
  }): AsyncIterable<string> {
    const { chatbotId, senderId, userMessage } = params;

    debugLogger.log('PIPELINE', `Starting RAG pipeline for chatbot=${chatbotId}, sender=${senderId}`);
    debugLogger.log('PIPELINE', `User message: "${userMessage}"`);
    debugLogger.log('PIPELINE', `Search mode: ${this.useHybridSearch ? 'HYBRID (vector + keyword)' : 'VECTOR (cosine similarity)'}`);

    // 1. Synchronously Fetch ChatBot Config (Cached in Redis -> 0ms Latency)
    const chatbotConfig = await this.getCachedChatbotConfig(chatbotId);
    if (!chatbotConfig || !chatbotConfig.business) {
      throw new Error(`ChatBot with ID ${chatbotId} or its associated Business profile was not found.`);
    }

    const businessPlan = chatbotConfig.business.plan;
    const isPrepaid = businessPlan?.plan_type === 'prepaid_credits' || !businessPlan; // default to true if prepaid or no plan
    const allowedServices = businessPlan?.services || [];
    const canUseProfileExtraction = isPrepaid || allowedServices.includes('profile_extraction');
    const canUseProductFetching = isPrepaid || allowedServices.includes('product_fetching');
    const canUseHumanHandoff = isPrepaid || allowedServices.includes('human_agent_handoff');

    // Tools available for this chat
    const updateProfileTool = this.toolRegistry.getTool('UpdateUserProfileTool');
    const fetchProductsTool = this.toolRegistry.getTool('FetchProductsTool');
    const requestHumanAgentTool = this.toolRegistry.getTool('RequestHumanAgentTool');
    const availableTools = [];
    
    // Unconditionally provide Human Agent Tool for semantic triggering
    if (canUseHumanHandoff && requestHumanAgentTool) {
      availableTools.push(requestHumanAgentTool.definition);
    }
    
    // --- GATEKEEPER PATTERN (Now Plan-Aware) ---
    const lowerMessage = userMessage.toLowerCase();
    
    // Profile Keywords Gatekeeper
    const profileKeywords = [
      'ကျွန်တော်', 'ကျနော်', 'ကျွန်တော့', 'ကျွန်တော့်', 'ကျနော့်', 'ကျနော့', 
      'ကျွန်မ', 'ကျမ', 'ကျွန်မရဲ့', 'ကျမရဲ့', 
      'ကိုယ့်', 'ကိုယ့်ရဲ့', 'ငါ', 'ငါ့', 'ကျုပ်', 'ကျုပ်တို့',
      'နာမည်', 'ဖုန်း', 'လိပ်စာ', 'နေတာ', 'နေပါတယ်', 'နေရပ်', 'ပို့ပေး',
      'ဆိုဒ်', 'အရောင်', 'ဝတ်တာ', 'စီးတာ', 'ကြိုက်', 'လိုချင်', 
      '09', '+95', 'name', 'phone', 'ph ', 'address', 'size', 'color', 
      'like', 'my ', 'prefer', 'i am', "i'm", 'mine'
    ];
    const mightContainProfile = profileKeywords.some(kw => lowerMessage.includes(kw));

    if (canUseProfileExtraction && updateProfileTool && mightContainProfile) {
      availableTools.push(updateProfileTool.definition);
    }

    if (canUseProductFetching && fetchProductsTool) {
      availableTools.push(fetchProductsTool.definition);
    }

    const parallelTasks: [
      Promise<string[]>,
      Promise<{ summary: string | null; recentMessages: any[] }>,
      Promise<any>,
      Promise<any | null>
    ] = [
      // 1. Keyword extraction (only needed for hybrid search, but cheap enough to always run)
      this.useHybridSearch ? this.extractKeywords(userMessage) : Promise.resolve([]),

      // 2. Fetch chat memory context (last 10 messages + summary)
      this.chatMemoryService.getContextForChat(chatbotId, senderId),
      
      // 3. Intent classification via LLM tool calling (run in parallel)
          availableTools.length > 0 
        ? this.llmService.executeToolCalling(
            [{ role: 'user', content: userMessage }], 
            availableTools,
            { systemPrompt: 'Evaluate the user message. If the user mentions personal facts, preferences, name, phone number, address, shoe size, or specific interests about themselves, trigger the UpdateUserProfileTool. If the user asks what products are available or asks for a list, trigger the FetchProductsTool. If the user wants to buy an item, asks for a discount, or explicitly asks for human staff support, trigger RequestHumanAgentTool. Otherwise, return normally.' }
          ).catch(err => {
             console.error('[ToolCalling Intention Check Error]', err);
             return null;
          })
        : Promise.resolve(null),

      // 4. Fetch User Profile for personalization (Cached in Redis)
      this.fetchUserProfile(chatbotId, senderId)
    ];

    const [extractedKeywords, memoryContext, toolResult, activeProfile] = await Promise.all(parallelTasks);
    const { summary: memorySummary, recentMessages } = memoryContext;

    const chatbot = chatbotConfig;

    // Process Tool Call Result if any
    let humanRequested = false;
    let newlyExtractedProfile = null;
    let fetchedProductsContext = '';

    if (toolResult) {
      if (toolResult.toolName === 'RequestHumanAgentTool') {
        humanRequested = true;
        if (requestHumanAgentTool) {
          try {
            const execResult = await requestHumanAgentTool.execute(toolResult.arguments, { chatbotId, senderId });
            if (execResult && execResult.status === 'success') {
              debugLogger.log('PIPELINE', `RequestHumanAgentTool executed successfully.`);
              // Inject the success message so LLM knows to tell the user to wait
              fetchedProductsContext = `[SYSTEM: ${execResult.message}]`;
            }
          } catch(err) {
            console.error('[RequestHumanAgentTool Trigger Error]', err);
          }
        }
      } else if (toolResult.toolName === 'UpdateUserProfileTool') {
        if (updateProfileTool) {
          try {
             const execResult = await updateProfileTool.execute(toolResult.arguments, { chatbotId, senderId });
             if (execResult && execResult.success) {
                newlyExtractedProfile = execResult.profile;
             }
          } catch(err) {
             console.error('[UpdateUserProfileTool Trigger Error]', err);
          }
        }
      } else if (toolResult.toolName === 'FetchProductsTool') {
        const fetchProductsTool = this.toolRegistry.getTool('FetchProductsTool');
        if (fetchProductsTool) {
          try {
             const execResult = await fetchProductsTool.execute(toolResult.arguments, { chatbotId, senderId });
             if (execResult && execResult.status === 'success' && execResult.data) {
                fetchedProductsContext = execResult.data;
                debugLogger.log('PIPELINE', `FetchProductsTool executed successfully. Fetched inventory list.`);
             }
          } catch(err) {
             console.error('[FetchProductsTool Trigger Error]', err);
          }
        }
      }
    }

    // ── Phase B: Search (vector-only or hybrid) ──────────────────────────
    const retrievedDocs = await this.search({
      chatbotId,
      businessId: chatbot.business_id,
      query: userMessage,
      keywords: extractedKeywords,
      limit: 3,
    });

    // Filter by minimum similarity threshold — don't inject irrelevant context
    const relevantDocs = retrievedDocs.filter(doc => doc.similarity >= MIN_SIMILARITY_THRESHOLD);
    let contextText = relevantDocs.map(doc => doc.text).join('\n---\n');

    // If FetchProductsTool returned a list, prepend it to the contextText
    if (fetchedProductsContext) {
      contextText = `${fetchedProductsContext}\n\n${contextText}`;
    }

    if (relevantDocs.length < retrievedDocs.length) {
      debugLogger.log('PIPELINE', `Filtered ${retrievedDocs.length - relevantDocs.length} docs below similarity threshold ${MIN_SIMILARITY_THRESHOLD} — keeping ${relevantDocs.length}`);
    }

    // ── Phase C: Build prompt & stream LLM response ──────────────────────
    // Build system prompt: custom_system_prompt takes priority over bot_role strategy
    const systemPrompt = this.promptFactory.getPromptWithCustomOverride(
      chatbot.bot_role || 'sales',
      chatbot.custom_system_prompt || null,
      {
        botName: chatbot.name,
        businessName: chatbot.business.name,
        businessDetailInfo: chatbot.business.detail_info,
        botType: chatbot.bot_role || 'sales',
        defaultLanguage: chatbot.default_language || 'Myanmar',
      }
    );

    let finalSystemPrompt = systemPrompt;

    // Inject User Profile (Facts)
    const profileToInject = newlyExtractedProfile || activeProfile;
    if (profileToInject && Object.keys(profileToInject).length > 0) {
      finalSystemPrompt += `\n\n[USER PROFILE / KNOWN FACTS]: You already know the following facts about the user. Do NOT ask them for this information again. Personalize your response using these facts:\n${JSON.stringify(profileToInject, null, 2)}`;
      debugLogger.log('PIPELINE', `Injected User Profile into prompt.`);
    }

    // Inject RAG Context
    if (contextText) {
      finalSystemPrompt += `\n\n[Context: Verified Business facts. Use ONLY this information to respond if applicable]:\n${contextText}`;
    } else {
      debugLogger.log('PIPELINE', `No relevant context found (all below threshold ${MIN_SIMILARITY_THRESHOLD}) — skipping context injection`);
    }

    if (humanRequested) {
      finalSystemPrompt += `\n\n[CRITICAL SYSTEM EVENT]: The user just requested to speak with a human/staff. The backend system has ALREADY successfully triggered the RequestHumanAgentTool and notified the human admin/staff. You MUST acknowledge this to the user gracefully. Tell them politely that the staff has been alerted and will respond shortly. Do NOT tell the user that you cannot contact a human. Do NOT offer to take a message, as the admin can already see this chat.`;
    }

    debugLogger.log('PROMPT', `System prompt (${chatbot.custom_system_prompt ? 'CUSTOM' : `role:${chatbot.bot_role}`}), length=${finalSystemPrompt.length} chars`);

    // Build messages payload
    const messagesPayload: ChatMessage[] = [];
    messagesPayload.push({ role: 'system', content: finalSystemPrompt });

    // Inject history summary if exists
    // Extract memory summary and recentMessages directly since we unpacked them at the top.
    const summary = memorySummary;
    if (summary) {
      messagesPayload.push({
        role: 'system',
        content: `[Summary of conversation history up to this point: ${summary}]`,
      });
    }

    // Append last 10 messages — use sender_type to determine role
    for (const msg of recentMessages) {
      messagesPayload.push({
        role: msg.sender_type === 'user' ? 'user' : 'assistant',
        content: msg.message,
      });
    }

    // Append the CURRENT user message as the final message
    // (it may already be in recentMessages if saved before RAG, but ensure it's last)
    const lastMsg = messagesPayload[messagesPayload.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userMessage) {
      messagesPayload.push({ role: 'user', content: userMessage });
    }

    debugLogger.log('PROMPT', `Messages payload: ${messagesPayload.length} messages (${recentMessages.length} history + ${summary ? 1 : 0} summary + current user)`);

    // Stream response from LLM
    let chunkCount = 0;
    let totalLength = 0;
    let fullResponseText = '';
    
    for await (const chunk of this.llmService.generateCompletionStream(messagesPayload)) {
      chunkCount++;
      totalLength += chunk.length;
      fullResponseText += chunk;
      yield chunk;
    }

    debugLogger.log('STREAM', `Completed: ${chunkCount} chunks, ${totalLength} total chars`);

    // --- AI AUTO-ESCALATION FEATURE (Output Gatekeeper) ---
    // If the LLM generated a fallback response indicating it doesn't know and will contact staff,
    // we programmatically trigger the human notification in the background!
    if (canUseHumanHandoff && !humanRequested) {
      const fallbackPhrases = [
        'ဆိုင်ဝန်ထမ်း', 'admin', 'လူနဲ့ပြပါ', 'ဆက်သွယ်ပေးပါမည်', 'မသိရှိပါ', 'မသိပါဘူး', 'မသေချာ', 
        'မသိနိုင်ပါ', 'တာဝန်ခံ', 'customer service', 'operator', 'ဖြေကြားပေးနိုင်မည်မဟုတ်', 'မရှိပါဘူး',
        'ချိတ်ဆက်ပေးပါမည်', 'အကြောင်းကြားပေးပါမည်', 'လူနဲ့ပြော', 'လူကိုယ်တိုင်', 'တိုက်ရိုက်'
      ];
      
      const needsEscalation = fallbackPhrases.some(phrase => fullResponseText.includes(phrase));
      
      if (needsEscalation) {
      debugLogger.log('PIPELINE', `AI Auto-Escalation detected in response text. Triggering RequestHumanAgentTool automatically.`);
      const humanTool = this.toolRegistry.getTool('RequestHumanAgentTool');
      if (humanTool) {
        void humanTool.execute(
          { reason: 'AI auto-escalated because it could not find the answer in the provided context.' },
          { chatbotId, senderId }
        ).catch(err => console.error('[Auto-Escalation Tool Error]', err));
      }
    }
  }
}

  /**
   * Extracts keywords using either local extraction (default) or LLM tool calling.
   */
  private async extractKeywords(userMessage: string): Promise<string[]> {
    if (!this.useToolCallingForExtraction) {
      // Local extraction: instant, no API call
      const result = this.localExtractor.extract(userMessage);
      debugLogger.log('KEYWORDS', `Local extraction from: "${userMessage}"`, result.exact_keywords);
      return result.exact_keywords;
    }

    // Tool-calling extraction via LLM
    debugLogger.log('KEYWORDS', `Using LLM tool calling for: "${userMessage}"`);
    const extractionTool = this.toolRegistry.getTool('QueryExtractionTool');
    if (extractionTool) {
      const toolResult = await this.llmService.executeToolCalling(
        [{ role: 'user', content: userMessage }],
        [extractionTool.definition]
      );
      if (toolResult && toolResult.toolName === 'QueryExtractionTool') {
        const executed = await extractionTool.execute(toolResult.arguments);
        const keywords = executed.exact_keywords || [];
        debugLogger.log('KEYWORDS', `LLM extracted keywords:`, keywords);
        return keywords;
      }
    }

    return [];
  }

  /**
   * Fetches User Profile (Facts). Tries Redis first, falls back to DB.
   * Caches the result in Redis for 24 hours.
   */
  private async fetchUserProfile(chatbotId: number, senderId: string): Promise<any | null> {
    const cacheKey = `user_profile:${chatbotId}:${senderId}`;
    try {
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn(`[Redis] Failed to fetch User Profile for ${senderId}:`, err);
    }

    // Fallback to PostgreSQL
    const chatbotUser = await ChatbotUser.findOne({
      where: { chatbot_id: chatbotId, sender_id: senderId }
    });

    const profileData = chatbotUser ? chatbotUser.profile_data : null;

    if (profileData) {
      // Save to Redis (24 hours TTL)
      try {
        await redisService.set(cacheKey, JSON.stringify(profileData), { EX: 86400 });
      } catch (err) {
        console.warn(`[Redis] Failed to cache User Profile for ${senderId}:`, err);
      }
    }

    return profileData;
  }

  /**
   * Unified search method — delegates to vector-only or hybrid search based on config.
   *
   * Vector Search (default):
   *   - ChromaDB cosine distance → convert to similarity (1 - distance)
   *   - Sort by cosine similarity descending
   *
   * Hybrid Search (optional):
   *   - Vector similarity (70%) + keyword overlap (30%) fusion ranking
   *   - Over-retrieves 3x candidates for re-ranking
   */
  async search(params: {
    chatbotId: number;
    businessId: number;
    query: string;
    keywords: string[];
    limit: number;
  }): Promise<SearchResultWithScores[]> {
    const { chatbotId, businessId, query, keywords, limit } = params;
    const collectionName = `business_${businessId}`;

    // A. Vector Search — embed query and search ChromaDB
    const queryEmbedding = await this.embeddingService.embedQuery(query);

    // Over-retrieve candidates for hybrid re-ranking, or exact limit for vector-only
    const retrieveCount = this.useHybridSearch ? limit * 3 : limit;

    const vectorCandidates = await this.vectorStore.search(
      collectionName,
      queryEmbedding,
      { chatbot_id: chatbotId },
      retrieveCount
    );

    debugLogger.logTable('VECTOR_SEARCH', `ChromaDB cosine results (${vectorCandidates.length} candidates from "${collectionName}"):`,
      vectorCandidates.map((c, i) => ({
        '#': i + 1,
        cosine_distance: c.score?.toFixed(4),
        cosine_similarity: (1 - c.score).toFixed(4),
        text: c.text?.substring(0, 80) + (c.text?.length > 80 ? '...' : ''),
      }))
    );

    // B. Score calculation
    const scoredResults: SearchResultWithScores[] = vectorCandidates.map(candidate => {
      // PgVectorStoreService already returns cosine similarity (1 - distance).
      const similarity = candidate.score;

      let wordMatchScore = 0;
      let finalScore = similarity; // Default: pure vector similarity

      if (this.useHybridSearch && keywords.length > 0) {
        // Hybrid mode: 30% keyword + 70% vector
        wordMatchScore = this.calculateWordMatchScore(candidate.text, keywords);
        finalScore = 0.3 * wordMatchScore + 0.7 * similarity;
      }

      return {
        ...candidate,
        similarity,
        wordMatchScore,
        finalScore,
      };
    });

    // C. Sort by final score and return top results
    const finalResults = scoredResults
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    const modeLabel = this.useHybridSearch ? 'hybrid' : 'vector';
    debugLogger.logTable('SEARCH_RANK', `Final top-${limit} (${modeLabel} mode):`,
      finalResults.map((r, i) => ({
        '#': i + 1,
        similarity: r.similarity.toFixed(4),
        ...(this.useHybridSearch ? { wordMatch: r.wordMatchScore.toFixed(4) } : {}),
        finalScore: r.finalScore.toFixed(4),
        text: r.text?.substring(0, 60) + (r.text?.length > 60 ? '...' : ''),
      }))
    );

    return finalResults;
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

    const score = matches / keywords.length;

    if (debugLogger.isEnabled() && keywords.length > 0) {
      debugLogger.log('KEYWORD_MATCH', `"${text.substring(0, 50)}..." — matched ${matches}/${keywords.length} keywords (score=${score.toFixed(4)})`);
    }

    return score;
  }
}
