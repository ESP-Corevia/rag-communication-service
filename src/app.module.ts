import { Module } from '@nestjs/common';
import { LLMService } from './services/llm.service';
import { PineconeService } from './services/pinecone.service';
import { WebSocketService } from './services/websocket.service';
import { MedecinGeneralisteAgent } from './agents/medecin.agent';

@Module({
  imports: [],
  controllers: [],
  providers: [
    LLMService,
    PineconeService,
    MedecinGeneralisteAgent,
    WebSocketService,
  ],
})
export class AppModule {}
