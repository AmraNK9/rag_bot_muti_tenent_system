/**
 * LocalKeywordExtractor
 *
 * Extracts keywords from user messages locally without an LLM API call.
 * Supports both English and Myanmar (Burmese) text.
 *
 * Strategy:
 *  - Detect Myanmar syllable sequences using Unicode range \u1000-\u109F
 *  - Extract English words with stop-word filtering
 *  - Generate bigrams for Myanmar compound words
 *  - Return deduplicated keyword list
 */

// Common English stop words to filter out
const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
]);

// Common Myanmar particles/stop words to filter out
const MYANMAR_STOP_WORDS = new Set([
  'က', 'ကို', 'မှာ', 'တွင်', '၌', 'နဲ့', 'နှင့်', 'ကြောင့်',
  'သည်', 'ဖြစ်သည်', 'ပါ', 'တယ်', 'ပါတယ်', 'ခဲ့', 'နေ', 'မည်',
  'လည်း', 'ပဲ', 'တော့', 'ရဲ့', 'ရှိ', 'ဟာ', 'ပြီး', 'ပြီ',
  'မှ', 'လဲ', 'ဘာ', 'ဘယ်', 'ဘယ်လို', 'ဘယ်နှစ်', 'ဘယ်လောက်',
  'ဒီ', 'အဲ', 'ဟို', 'တစ်', 'နှစ်', 'သုံး', 'ခု', 'လုံး',
  'တွေ', 'များ', 'ချင်', 'ရ', 'မ', 'တတ်', 'နိုင်', 'ဖို့',
  'အတွက်', 'ကျွန်တော်', 'ကျွန်မ', 'ငါ',
]);

// Myanmar Unicode range: \u1000-\u109F (main block)
const MYANMAR_CHAR_REGEX = /[\u1000-\u109F]/;
const MYANMAR_WORD_REGEX = /[\u1000-\u109F]+/g;
const ENGLISH_WORD_REGEX = /[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*/g;

export interface KeywordExtractionResult {
  exact_keywords: string[];
}

export class LocalKeywordExtractor {
  /**
   * Extract keywords from a user message.
   * Returns a list of relevant keywords for hybrid search.
   */
  extract(text: string): KeywordExtractionResult {
    const keywords: string[] = [];

    // 1. Extract English keywords
    const englishWords = text.match(ENGLISH_WORD_REGEX) || [];
    for (const word of englishWords) {
      const lower = word.toLowerCase();
      // Keep words that are not stop words and have meaningful length
      if (!ENGLISH_STOP_WORDS.has(lower) && lower.length > 1) {
        keywords.push(word); // Preserve original casing for brand names
      }
    }

    // 2. Extract Myanmar word segments
    const myanmarSegments = this.segmentMyanmar(text);
    for (const segment of myanmarSegments) {
      if (!MYANMAR_STOP_WORDS.has(segment) && segment.length > 1) {
        keywords.push(segment);
      }
    }

    // 3. Generate Myanmar bigrams for compound nouns
    if (myanmarSegments.length >= 2) {
      for (let i = 0; i < myanmarSegments.length - 1; i++) {
        const bigram = myanmarSegments[i] + myanmarSegments[i + 1];
        // Only include bigrams that aren't just stop words combined
        if (!MYANMAR_STOP_WORDS.has(myanmarSegments[i]) || !MYANMAR_STOP_WORDS.has(myanmarSegments[i + 1])) {
          keywords.push(bigram);
        }
      }
    }

    // 4. Deduplicate while preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const kw of keywords) {
      const key = kw.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(kw);
      }
    }

    return { exact_keywords: deduped };
  }

  /**
   * Segment Myanmar text into word-like units.
   * Uses a syllable-boundary heuristic based on consonant clusters.
   *
   * Myanmar script doesn't use spaces between words, so we split on:
   *  - Whitespace and punctuation (if present)
   *  - Myanmar sentence-ending marks: ။ (U+104B) and ၊ (U+104A)
   *  - Sequences of Myanmar characters between non-Myanmar characters
   */
  private segmentMyanmar(text: string): string[] {
    const segments: string[] = [];

    // Split on whitespace, punctuation marks, and Myanmar sentence markers
    const parts = text.split(/[\s။၊,!?.;:\-]+/);

    for (const part of parts) {
      // Extract continuous Myanmar character sequences
      const myanmarMatches = part.match(MYANMAR_WORD_REGEX);
      if (myanmarMatches) {
        for (const match of myanmarMatches) {
          // Further split on Myanmar virama (္) boundaries for compound syllables
          // Keep the segment as-is if it's a reasonable length
          if (match.length <= 15) {
            segments.push(match);
          } else {
            // For very long sequences, attempt syllable-level splitting
            const syllables = this.splitMyanmarSyllables(match);
            segments.push(...syllables);
          }
        }
      }
    }

    return segments;
  }

  /**
   * Basic Myanmar syllable splitter.
   * Splits on boundaries before consonants that follow a vowel or final marker.
   * This is a heuristic — not a full NLP segmenter.
   */
  private splitMyanmarSyllables(text: string): string[] {
    // Myanmar consonants: U+1000-U+1021
    // Split before a consonant that follows a non-consonant (vowel sign, etc.)
    const syllables: string[] = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = char.charCodeAt(0);

      // Check if this is a Myanmar consonant (U+1000-U+1021)
      const isConsonant = code >= 0x1000 && code <= 0x1021;

      // If we hit a consonant and current is non-empty and previous char
      // is not a virama (္ U+1039), treat it as a potential syllable boundary
      if (isConsonant && current.length > 0) {
        const prevCode = text.charCodeAt(i - 1);
        if (prevCode !== 0x1039) {
          // Syllable boundary — push current and start new
          syllables.push(current);
          current = char;
          continue;
        }
      }

      current += char;
    }

    if (current) {
      syllables.push(current);
    }

    // Filter out very short syllables (likely fragments)
    return syllables.filter(s => s.length > 1);
  }
}
