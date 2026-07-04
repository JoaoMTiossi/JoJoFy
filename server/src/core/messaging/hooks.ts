/**
 * Ponto de extensão para reagir a eventos do pipeline de mensagens sem
 * acoplar o núcleo de mensageria ao WebhookDispatcher (M4) ou a outros
 * consumidores futuros.
 */
export type DomainEvent = "message.created" | "message.status" | "message.received" | "contact.optout";

type Listener = (event: DomainEvent, payload: any) => void | Promise<void>;

const listeners: Listener[] = [];

export function onMessageEvent(listener: Listener) {
  listeners.push(listener);
}

export async function emitMessageEvent(event: DomainEvent, payload: any) {
  for (const listener of listeners) {
    await listener(event, payload);
  }
}
