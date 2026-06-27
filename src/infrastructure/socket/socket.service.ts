import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

export class SocketService {
  private static _io: SocketIOServer | null = null;

  public static init(server: HttpServer): void {
    if (!this._io) {
      this._io = new SocketIOServer(server, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
        }
      });

      this._io.on('connection', (socket) => {
        // console.log(`[Socket] Client connected: ${socket.id}`);

        // A client (e.g. Chatbot Admin app) asks to join a specific chatbot's room
        socket.on('join_room', (chatbotId: string | number) => {
          socket.join(chatbotId.toString());
          // console.log(`[Socket] Client ${socket.id} joined room: ${chatbotId}`);
        });

        // A reseller asks to join their specific reseller room
        socket.on('join_reseller_room', (resellerId: string | number) => {
          socket.join(`reseller_${resellerId}`);
          // console.log(`[Socket] Reseller client ${socket.id} joined room: reseller_${resellerId}`);
        });

        // A total admin asks to join the global total admin room
        socket.on('join_total_admin_room', () => {
          socket.join('total_admin');
          // console.log(`[Socket] Total Admin client ${socket.id} joined room: total_admin`);
        });

        socket.on('disconnect', () => {
          // console.log(`[Socket] Client disconnected: ${socket.id}`);
        });
      });
    }
  }

  public static get io(): SocketIOServer {
    if (!this._io) {
      throw new Error("SocketService has not been initialized. Call init() first.");
    }
    return this._io;
  }
}
