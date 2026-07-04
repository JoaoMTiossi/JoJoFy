/**
 * Ponto de extensão para reagir a eventos do pipeline de mensagens sem
 * acoplar o núcleo de mensageria ao WebhookDispatcher (M4) ou a outros
 * consumidores futuros.
 */
type MessageEvent = "message.created" | "message.status" | "message.received";

type Listener = (event: MessageEvent, payload: any) => void | Promise<void>;

const listeners: Listener[] = [];

export function onMessageEvent(listener: Listener) {
  listeners.push(listener);
}

export async function emitMessageEvent(event: MessageEvent, payload: any) {
  for (const listener of listeners) {
    await listener(event, payload);
  }
}
