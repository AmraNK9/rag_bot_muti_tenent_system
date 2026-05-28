import { IEmbeddingService } from '../../core/interfaces/embedding.interface';
declare const process: { env: { VOYAGE_API_KEY?: string } };
export class VoyageEmbeddingService implements IEmbeddingService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.VOYAGE_API_KEY || 'mock-key';
    this.baseUrl = 'https://api.voyageai.com/v1';
    this.model = model || 'voyage-4';
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      const response = await this.makeApiRequest([text]);
      return response.data[0].embedding;
    } catch (error) {
      console.error('Voyage AI embedding error (Query):', error);
      throw new Error(`Voyage AI embedding failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const response = await this.makeApiRequest(texts);
      return response.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('Voyage AI embedding error (Documents):', error);
      throw new Error(`Voyage AI embedding failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async makeApiRequest(input: string[]): Promise<any> {
    if (this.apiKey === 'mock-key') {
      // Mocked 1024-dimension float vectors
      const mockEmbeddings = input.map(() => 
        Array.from({ length: 1024 }, () => Math.random() - 0.5)
      );
      return {
        data: mockEmbeddings.map((emb, index) => ({
          object: 'embedding',
          index,
          embedding: emb
        }))
      };
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        input,
        model: this.model
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Voyage API error (${response.status}): ${errText}`);
    }

    return response.json();
  }
}
