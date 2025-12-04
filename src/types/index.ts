export interface ClientMessage {
  type: 'query';
  agent: string;
  query: string;
  userId: string;
}

export interface ServerMessage {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  message?: string;
}

export interface RAGContext {
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  content: string;
  isUrgent?: boolean;
  shouldRedirect?: boolean;
}

export enum AgentType {
  MEDECIN_GENERALISTE = 'medecin_generaliste',
}

export interface PineconeMatch {
  id: string;
  score: number;
  metadata: Record<string, any>;
}
