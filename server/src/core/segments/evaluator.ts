import { prisma } from "../../lib/prisma";

export interface SegmentCondition {
  attr: string; // "name" | "phone" | "email" | nome de um AttributeDef
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists" | "not_exists";
  value?: string | number;
}

export interface SegmentFilter {
  logic: "AND";
  conditions: SegmentCondition[];
}

const BUILTIN_FIELDS = new Set(["name", "phone", "email"]);

/** Contexto avaliável de um contato: campos nativos + mapa de atributos customizados. */
export interface EvaluableContact {
  name: string;
  phone: string | null;
  email: string | null;
  attributes: Record<string, { value: string; type: string }>;
}

export function evaluateCondition(contact: EvaluableContact, condition: SegmentCondition): boolean {
  const raw: string | null | undefined = BUILTIN_FIELDS.has(condition.attr)
    ? (contact as any)[condition.attr]
    : contact.attributes[condition.attr]?.value;

  if (condition.op === "exists") return raw !== undefined && raw !== null && raw !== "";
  if (condition.op === "not_exists") return raw === undefined || raw === null || raw === "";

  if (raw === undefined || raw === null) return false;

  const attrType = BUILTIN_FIELDS.has(condition.attr) ? "TEXT" : contact.attributes[condition.attr]?.type ?? "TEXT";

  if (attrType === "NUMBER") {
    const a = Number(raw);
    const b = Number(condition.value);
    switch (condition.op) {
      case "eq":
        return a === b;
      case "neq":
        return a !== b;
      case "gt":
        return a > b;
      case "gte":
        return a >= b;
      case "lt":
        return a < b;
      case "lte":
        return a <= b;
      case "contains":
        return String(a).includes(String(condition.value));
    }
  }

  if (attrType === "DATE") {
    const a = new Date(raw).getTime();
    const b = new Date(String(condition.value)).getTime();
    switch (condition.op) {
      case "eq":
        return a === b;
      case "neq":
        return a !== b;
      case "gt":
        return a > b;
      case "gte":
        return a >= b;
      case "lt":
        return a < b;
      case "lte":
        return a <= b;
      case "contains":
        return raw.includes(String(condition.value));
    }
  }

  // TEXT / SELECT
  const a = raw.toLowerCase();
  const b = String(condition.value ?? "").toLowerCase();
  switch (condition.op) {
    case "eq":
      return a === b;
    case "neq":
      return a !== b;
    case "contains":
      return a.includes(b);
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
  }
  return false;
}

export function evaluateFilter(contact: EvaluableContact, filter: SegmentFilter): boolean {
  if (!filter.conditions || filter.conditions.length === 0) return true;
  return filter.conditions.every((c) => evaluateCondition(contact, c));
}

export function toEvaluableContact(contact: {
  name: string;
  phone: string | null;
  email: string | null;
  attributeValues: { value: string; def: { name: string; type: string } }[];
}): EvaluableContact {
  const attributes: Record<string, { value: string; type: string }> = {};
  for (const av of contact.attributeValues) {
    attributes[av.def.name] = { value: av.value, type: av.def.type };
  }
  return { name: contact.name, phone: contact.phone, email: contact.email, attributes };
}

/** Resolve todos os contatos da conta que casam com o filtro de um segmento. */
export async function resolveSegmentContactIds(accountId: string, filter: SegmentFilter): Promise<string[]> {
  const contacts = await prisma.contact.findMany({
    where: { accountId },
    include: { attributeValues: { include: { def: true } } },
  });
  return contacts.filter((c) => evaluateFilter(toEvaluableContact(c), filter)).map((c) => c.id);
}
