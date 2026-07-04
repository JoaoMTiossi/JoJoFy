import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import jwt from "jsonwebtoken";
import { realtimeHub } from "../core/realtime/hub";

export default fp(async function websocketPlugin(fastify) {
  await fastify.register(websocket);

  fastify.get("/ws", { websocket: true }, (socket, req) => {
    const token = (req.query as any)?.token as string | undefined;
    if (!token) {
      socket.close(1008, "token ausente");
      return;
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me") as { accountId: string };
      realtimeHub.join(payload.accountId, socket);
      socket.send(JSON.stringify({ type: "connected", payload: {}, at: new Date().toISOString() }));
    } catch {
      socket.close(1008, "token inválido");
    }
  });
});
