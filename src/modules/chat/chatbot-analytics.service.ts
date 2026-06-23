import { ChatbotActivity } from '../../infrastructure/db/models';

interface ActivityBuffer {
  queryCount: number;
  apiCost: number;
}

export class ChatbotAnalyticsService {
  private static buffer: Map<string, ActivityBuffer> = new Map();
  private static flushInterval: NodeJS.Timeout | null = null;

  /**
   * Accumulates activity metrics in memory to prevent database overhead.
   */
  public static recordActivity(chatbotId: number, queryCount: number, apiCost: number) {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${chatbotId}_${todayStr}`;

    const existing = this.buffer.get(key) || { queryCount: 0, apiCost: 0 };
    existing.queryCount += queryCount;
    existing.apiCost += apiCost;

    this.buffer.set(key, existing);
  }

  /**
   * Flushes in-memory metrics to the database.
   * Performs bulk upserts for all buffered activities.
   */
  public static async flushToDatabase(): Promise<void> {
    if (this.buffer.size === 0) return;

    // Snapshot current buffer and clear to prevent race conditions during async write
    const snapshot = new Map(this.buffer);
    this.buffer.clear();

    console.log(`[Analytics] Flushing ${snapshot.size} activity logs to database...`);

    for (const [key, value] of snapshot.entries()) {
      const [chatbotIdStr, activityDate] = key.split('_');
      const chatbotId = Number(chatbotIdStr);

      try {
        // Find existing record for this bot and date
        const record = await ChatbotActivity.findOne({
          where: { chatbot_id: chatbotId, activity_date: activityDate },
        });

        if (record) {
          await record.update({
            query_count: record.query_count + value.queryCount,
            api_cost: Number(record.api_cost) + value.apiCost,
          });
        } else {
          await ChatbotActivity.create({
            chatbot_id: chatbotId,
            activity_date: activityDate,
            query_count: value.queryCount,
            api_cost: value.apiCost,
            active_duration_seconds: 60, // Mock baseline active seconds
          });
        }
      } catch (err) {
        console.error(`[Analytics] Failed to flush activity for chatbot ${chatbotId}:`, err);
        // Put back into buffer to retry next time
        this.recordActivity(chatbotId, value.queryCount, value.apiCost);
      }
    }
  }

  /**
   * Starts background flusher (e.g. every 60 seconds)
   */
  public static startScheduler(intervalMs = 60000) {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      void this.flushToDatabase().catch(console.error);
    }, intervalMs);
    console.log(`[Analytics] Scheduled buffer flusher started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stops background flusher
   */
  public static stopScheduler() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}
