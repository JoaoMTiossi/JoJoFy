import { parse } from "csv-parse/sync";
import { prisma } from "../../lib/prisma";
import { toE164, isValidE164 } from "../../lib/e164";
import { Errors } from "../../lib/errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CsvImportMapping {
  name: string; // header da coluna que vira o nome
  phone?: string;
  email?: string;
  ownerEmail?: string; // header da coluna owner_email → dono (User) do contato
  attributes?: Record<string, string>; // AttributeDef.name -> header da coluna
}

export interface CsvImportError {
  line: number;
  message: string;
}

export interface CsvImportReport {
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: CsvImportError[];
}

export async function importContactsFromCsv(
  accountId: string,
  csvText: string,
  mapping: CsvImportMapping,
  listId?: string
): Promise<CsvImportReport> {
  const records: Record<string, string>[] = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const attributeDefEntries = Object.entries(mapping.attributes ?? {});
  const defsByName = new Map<string, { id: string; name: string; type: string }>();
  for (const [defName] of attributeDefEntries) {
    const def = await prisma.attributeDef.findUnique({ where: { accountId_name: { accountId, name: defName } } });
    if (!def) throw Errors.badRequest(`Atributo customizado "${defName}" não existe nesta conta`);
    defsByName.set(defName, def);
  }

  // donos por e-mail (coluna opcional owner_email)
  const accountUsers = await prisma.user.findMany({ where: { accountId } });
  const usersByEmail = new Map(accountUsers.map((u) => [u.email.toLowerCase(), u]));

  const existingContacts = await prisma.contact.findMany({ where: { accountId } });
  const existingPhones = new Set(existingContacts.map((c) => c.phone).filter(Boolean) as string[]);
  const existingEmails = new Set(existingContacts.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[]);
  const existingByPhone = new Map(existingContacts.filter((c) => c.phone).map((c) => [c.phone as string, c]));
  const existingByEmail = new Map(existingContacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]));

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  const errors: CsvImportError[] = [];
  let importedCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < records.length; i++) {
    const line = i + 2; // +1 header, +1 para 1-based
    const record = records[i];
    const name = mapping.name ? record[mapping.name]?.trim() : undefined;
    const rawPhone = mapping.phone ? record[mapping.phone]?.trim() : undefined;
    const rawEmail = mapping.email ? record[mapping.email]?.trim() : undefined;

    if (!name) {
      errors.push({ line, message: "Nome é obrigatório" });
      continue;
    }

    let phone: string | undefined;
    if (rawPhone) {
      phone = toE164(rawPhone);
      if (!isValidE164(phone)) {
        errors.push({ line, message: `Telefone inválido: "${rawPhone}"` });
        continue;
      }
    }

    let email: string | undefined;
    if (rawEmail) {
      if (!EMAIL_RE.test(rawEmail)) {
        errors.push({ line, message: `E-mail inválido: "${rawEmail}"` });
        continue;
      }
      email = rawEmail.toLowerCase();
    }

    if (!phone && !email) {
      errors.push({ line, message: "Informe ao menos telefone ou e-mail" });
      continue;
    }

    // coluna opcional owner_email → dono do contato; e-mail desconhecido é erro
    // de linha (as demais linhas continuam sendo importadas)
    let ownerId: string | undefined;
    const rawOwnerEmail = mapping.ownerEmail ? record[mapping.ownerEmail]?.trim() : undefined;
    if (rawOwnerEmail) {
      const owner = usersByEmail.get(rawOwnerEmail.toLowerCase());
      if (!owner) {
        errors.push({ line, message: `Dono não encontrado: "${rawOwnerEmail}" não é um usuário desta conta` });
        continue;
      }
      ownerId = owner.id;
    }

    const dupInBatch = (phone && seenPhones.has(phone)) || (email && seenEmails.has(email));
    const existing =
      (phone && (existingByPhone.get(phone) ?? undefined)) || (email && (existingByEmail.get(email) ?? undefined));
    const dupInDb = (phone && existingPhones.has(phone)) || (email && existingEmails.has(email));

    if (dupInBatch || dupInDb) {
      duplicateCount++;
      if (existing && listId) {
        await prisma.listMember
          .create({ data: { listId, contactId: existing.id } })
          .catch(() => undefined); // já é membro
      }
      continue;
    }

    if (phone) seenPhones.add(phone);
    if (email) seenEmails.add(email);

    const contact = await prisma.contact.create({
      data: { accountId, name, phone, email, ownerId },
    });

    for (const [defName, header] of attributeDefEntries) {
      const value = record[header]?.trim();
      if (!value) continue;
      const def = defsByName.get(defName)!;
      await prisma.attributeValue.create({ data: { contactId: contact.id, defId: def.id, value } });
    }

    if (listId) {
      await prisma.listMember.create({ data: { listId, contactId: contact.id } });
    }

    importedCount++;
  }

  return {
    totalRows: records.length,
    importedCount,
    duplicateCount,
    errorCount: errors.length,
    errors,
  };
}
