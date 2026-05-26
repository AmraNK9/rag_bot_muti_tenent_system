export interface IEmbeddingService {
  /**
   * Generates a 1D vector embedding for the given text.
   */
  embedQuery(text: string): Promise<number[]>;

  /**
   * Generates embeddings in batch for multiple documents/texts.
   */
  embedDocuments(texts: string[]): Promise<number[][]>;
}
