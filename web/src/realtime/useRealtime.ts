import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * WebSocket de notificação: ao receber qualquer evento, apenas invalida as
 * queries relevantes — os dados são sempre rebuscados via TanStack Query
 * (evita divergência entre push e cache).
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const attemptRef = useRef(0);

  useEffect(() => {
    const token = localStorage.getItem("zenvia_token");
    if (!token) return;

    let socket: WebSocket | null = null;
    let closedByClient = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/ws?token=${encodeURIComponent(token!)}`);

      socket.onopen = () => {
        attemptRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const { type } = JSON.parse(event.data);
          if (type === "message.updated" || type === "message.created" || type === "message.received") {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["conversation"] });
            queryClient.invalidateQueries({ queryKey: ["contact"] });
          }
          if (type === "conversation.updated") {
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
            queryClient.invalidateQueries({ queryKey: ["conversation"] });
            queryClient.invalidateQueries({ queryKey: ["supervision"] });
          }
        } catch {
          // ignora mensagens que não sejam JSON válido
        }
      };

      socket.onclose = () => {
        if (closedByClient) return;
        const delay = Math.min(1000 * 2 ** attemptRef.current, 15000);
        attemptRef.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      closedByClient = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient]);
}
