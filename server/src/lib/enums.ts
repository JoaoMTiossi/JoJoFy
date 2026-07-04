// SQLite não tem enum nativo no Prisma: os valores abaixo documentam e tipam
// (na camada de aplicação) as colunas String usadas como enum no schema.

export const ROLES = ["ADMIN", "MANAGER", "AGENT", "DEVELOPER"] as const;
export type Role = (typeof ROLES)[number];

export const CHANNEL_TYPES = ["WHATSAPP", "EMAIL"] as const;
export type ChannelTypeValue = (typeof CHANNEL_TYPES)[number];

export const ATTR_TYPES = ["TEXT", "NUMBER", "DATE", "SELECT"] as const;
export type AttrTypeValue = (typeof ATTR_TYPES)[number];

export const TEMPLATE_STATUSES = ["DRAFT", "APPROVED", "REJECTED"] as const;
export const MESSAGE_DIRECTIONS = ["IN", "OUT"] as const;
export const MESSAGE_SOURCES = ["API", "CAMPAIGN", "BOT", "AGENT", "JOURNEY", "SIMULATOR"] as const;
export const MESSAGE_STATUSES = ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"] as const;
export type MessageStatusValue = (typeof MESSAGE_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "RUNNING", "DONE", "CANCELED"] as const;
export const JOURNEY_STATUSES = ["DRAFT", "ACTIVE", "PAUSED"] as const;
export const FLOW_SESSION_STATUSES = ["ACTIVE", "DONE", "TRANSFERRED"] as const;
export const QUEUE_STRATEGIES = ["ROUND_ROBIN", "LEAST_BUSY"] as const;
export const CONVERSATION_STATUSES = ["OPEN", "ASSIGNED", "RESOLVED"] as const;
export const AGENT_PRESENCES = ["ONLINE", "AWAY", "OFFLINE"] as const;
export const JOB_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED"] as const;
