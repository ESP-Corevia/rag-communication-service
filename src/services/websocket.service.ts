import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { ClientMessage, ServerMessage } from '../types';
import { MedecinGeneralisteAgent } from '../agents/medecin.agent';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebSocketService implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private agents: Map<string, any> = new Map();

  constructor(private medecinAgent: MedecinGeneralisteAgent) {
    this.agents.set('medecin_generaliste', medecinAgent);
    logger.info('WebSocket service initialized');
  }

  handleConnection(client: Socket) {
    logger.info(`Client connected: ${client.id}`);
    client.emit('connection', { message: 'Connected to Corevia IA Service' });
  }

  handleDisconnect(client: Socket) {
    logger.info(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('query')
  async handleQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ClientMessage
  ) {
    try {
      logger.info(`Received query from user ${data.userId}: ${data.query.substring(0, 50)}...`);

      const { agent, query, userId } = data;

      // Get the appropriate agent
      const agentInstance = this.agents.get(agent);
      if (!agentInstance) {
        const errorMsg: ServerMessage = {
          type: 'error',
          message: `Agent '${agent}' not found`,
        };
        client.emit('message', errorMsg);
        return;
      }

      // Stream response from agent
      try {
        for await (const chunk of agentInstance.processQuery(query, userId)) {
          const chunkMsg: ServerMessage = {
            type: 'chunk',
            content: chunk,
          };
          client.emit('message', chunkMsg);
        }

        // Send done signal
        const doneMsg: ServerMessage = {
          type: 'done',
        };
        client.emit('message', doneMsg);

        logger.info(`Query processed successfully for user ${userId}`);
      } catch (agentError) {
        logger.error('Agent processing error:', agentError);
        const errorMsg: ServerMessage = {
          type: 'error',
          message: 'Une erreur est survenue lors du traitement de votre demande',
        };
        client.emit('message', errorMsg);
      }
    } catch (error) {
      logger.error('Error handling query:', error);
      const errorMsg: ServerMessage = {
        type: 'error',
        message: 'Une erreur inattendue est survenue',
      };
      client.emit('message', errorMsg);
    }
  }
}
