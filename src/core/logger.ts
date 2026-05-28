/**
 * DebugLogger
 *
 * Environment-controlled debug logging utility for the RAG pipeline.
 * Enabled via DEBUG_MODE=true in .env
 *
 * Categories:
 *  [KEYWORDS]      — Local keyword extractor output
 *  [VECTOR_SEARCH] — ChromaDB similarity top-k results
 *  [KEYWORD_MATCH] — Word match scores per document
 *  [HYBRID_RANK]   — Final weighted fusion ranking
 *  [PROMPT]        — Built system prompt (truncated)
 *  [STREAM]        — Stream statistics
 *  [AUTH]          — Authentication events
 *  [CREDITS]      — Credit deduction events
 */

declare const process: { env: { DEBUG_MODE?: string } };

export class DebugLogger {
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.DEBUG_MODE === 'true';
  }

  /**
   * Log a debug message with a category tag.
   */
  log(category: string, message: string, data?: any): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
    const prefix = `\x1b[36m[${timestamp}]\x1b[0m \x1b[33m[${category}]\x1b[0m`;

    if (data !== undefined) {
      console.log(`${prefix} ${message}`);
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`  → ${data}`);
      }
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Log a table of ranked results for readability.
   */
  logTable(category: string, title: string, rows: Array<Record<string, any>>): void {
    if (!this.enabled || rows.length === 0) return;

    const timestamp = new Date().toISOString().slice(11, 23);
    console.log(`\x1b[36m[${timestamp}]\x1b[0m \x1b[33m[${category}]\x1b[0m ${title}`);
    console.table(rows);
  }

  /**
   * Check if debug mode is active.
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/** Singleton debug logger instance */
export const debugLogger = new DebugLogger();
