/** Renderiza um template com variáveis no formato {{var}}. */
export function renderTemplate(body: string, vars: Record<string, string | number | undefined>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

/** Extrai os nomes de variáveis {{var}} usados em um template. */
export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  const regex = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body))) {
    found.add(m[1]);
  }
  return [...found];
}
