import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attach(server);
    server.on('connection', (socket: Socket) => {
      const token = String(socket.handshake.auth?.token ?? '');
      if (!token) return;
      try {
        const payload = this.jwt.verify<{ sub: string }>(token);
        socket.join(`user:${payload.sub}`);
      } catch {
        socket.disconnect();
      }
      socket.on('live:join', (body: { code?: string }) => {
        if (body?.code) socket.join(`live:${body.code.toUpperCase()}`);
      });
    });
  }
}
