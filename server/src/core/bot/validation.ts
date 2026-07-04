export interface AnswerValidation {
  type: "email" | "number" | "date" | "regex";
  pattern?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAnswer(text: string, validation?: AnswerValidation): boolean {
  if (!validation) return true;
  const trimmed = text.trim();
  switch (validation.type) {
    case "email":
      return EMAIL_RE.test(trimmed);
    case "number":
      return trimmed !== "" && !Number.isNaN(Number(trimmed));
    case "date":
      return !Number.isNaN(Date.parse(trimmed));
    case "regex":
      try {
        return new RegExp(validation.pattern ?? ".*").test(trimmed);
      } catch {
        return true;
      }
    default:
      return true;
  }
}
