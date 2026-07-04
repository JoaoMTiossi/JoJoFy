import type { WebSocket } from "ws";

/** Hub de WebSocket: um "canal" por conta (accountId). Só notifica —
 * o frontend sempre rebusca dados via TanStack Query ao receber um evento. */
class RealtimeHub {
  private rooms = new Map<string, Set<WebSocket>>();

  join(accountId: string, socket: WebSocket) {
    if (!this.rooms.has(accountId)) this.rooms.set(accountId, new Set());
    this.rooms.get(accountId)!.add(socket);
    socket.on("close", () => this.leave(accountId, socket));
  }

  leave(accountId: string, socket: WebSocket) {
    this.rooms.get(accountId)?.delete(socket);
  }

  broadcast(accountId: string, type: string, payload: unknown) {
    const sockets = this.rooms.get(accountId);
    if (!sockets || sockets.size === 0) return;
    const message = JSON.stringify({ type, payload, at: new Date().toISOString() });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
  }
}

export const realtimeHub = new RealtimeHub();
