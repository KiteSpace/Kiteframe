export type AiMessage = { role: 'system'|'user'|'assistant'|'tool'; content: string };
export type AiRequest = { model?: string; messages: AiMessage[]; temperature?: number; maxTokens?: number; stream?: boolean };
export type AiResponse = { text: string };

export interface AiClient {
  chat(req: AiRequest): Promise<AiResponse>;
  stream?(req: AiRequest, onToken: (t:string)=>void): Promise<void>;
}
