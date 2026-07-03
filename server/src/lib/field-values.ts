import { badRequest } from "./http-error.js";

export interface FieldDefinition {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates raw field values submitted for a card against the pipe's field
 * definitions. Returns a map of fieldId -> serialized string value (only for
 * fields that received a value).
 */
export function validateFieldValues(
  fields: FieldDefinition[],
  rawValues: Record<string, unknown> | undefined,
  { partial = false }: { partial?: boolean } = {}
): Record<string, string> {
  const values = rawValues ?? {};
  const result: Record<string, string> = {};
  const details: Record<string, string> = {};

  for (const field of fields) {
    const hasValue = Object.prototype.hasOwnProperty.call(values, field.id);
    const raw = values[field.id];
    const isEmpty = raw === undefined || raw === null || raw === "";

    if (!hasValue) {
      if (field.required && !partial) {
        details[field.id] = `Campo "${field.label}" é obrigatório`;
      }
      continue;
    }

    if (isEmpty) {
      if (field.required) {
        details[field.id] = `Campo "${field.label}" é obrigatório`;
      }
      continue;
    }

    switch (field.type) {
      case "number": {
        const num = Number(raw);
        if (Number.isNaN(num)) {
          details[field.id] = `Campo "${field.label}" deve ser numérico`;
          continue;
        }
        result[field.id] = String(num);
        break;
      }
      case "date": {
        const date = new Date(String(raw));
        if (Number.isNaN(date.getTime())) {
          details[field.id] = `Campo "${field.label}" deve ser uma data válida`;
          continue;
        }
        result[field.id] = date.toISOString();
        break;
      }
      case "email": {
        if (!EMAIL_RE.test(String(raw))) {
          details[field.id] = `Campo "${field.label}" deve ser um e-mail válido`;
          continue;
        }
        result[field.id] = String(raw);
        break;
      }
      case "select": {
        const options: string[] = field.options ? JSON.parse(field.options) : [];
        if (!options.includes(String(raw))) {
          details[field.id] = `Campo "${field.label}" possui um valor inválido`;
          continue;
        }
        result[field.id] = String(raw);
        break;
      }
      default: {
        result[field.id] = String(raw);
      }
    }
  }

  if (Object.keys(details).length > 0) {
    throw badRequest("Erro de validação dos campos", details);
  }

  return result;
}
