import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server?: Server;

  attach(server: Server) {
    this.server = server;
  }

  to(room: string, event: string, payload: unknown) {
    this.server?.to(room).emit(event, payload);
  }
}
