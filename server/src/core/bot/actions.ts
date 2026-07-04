import { prisma } from "../../lib/prisma";
import { renderTemplate } from "../../lib/template-render";

export interface ActionConfig {
  actionType: "update_attribute" | "add_tag" | "add_to_list" | "webhook";
  attr?: string;
  value?: string;
  tag?: string;
  listId?: string;
  url?: string;
}

/** Executa um nó de ação do fluxo: atualizar atributo do contato, adicionar
 * a uma lista, marcar uma tag (guardada como atributo "tags") ou chamar um
 * webhook externo. */
export async function executeAction(
  accountId: string,
  contactId: string,
  action: ActionConfig,
  variables: Record<string, string> = {}
) {
  switch (action.actionType) {
    case "update_attribute": {
      if (!action.attr) return;
      const def = await prisma.attributeDef.findUnique({ where: { accountId_name: { accountId, name: action.attr } } });
      if (!def) return;
      const value = renderTemplate(action.value ?? "", variables);
      await prisma.attributeValue.upsert({
        where: { contactId_defId: { contactId, defId: def.id } },
        update: { value },
        create: { contactId, defId: def.id, value },
      });
      return;
    }
    case "add_tag": {
      if (!action.tag) return;
      let def = await prisma.attributeDef.findUnique({ where: { accountId_name: { accountId, name: "tags" } } });
      if (!def) {
        def = await prisma.attributeDef.create({ data: { accountId, name: "tags", type: "TEXT" } });
      }
      const existing = await prisma.attributeValue.findUnique({ where: { contactId_defId: { contactId, defId: def.id } } });
      const tags = new Set((existing?.value ?? "").split(",").map((t) => t.trim()).filter(Boolean));
      tags.add(action.tag);
      const value = [...tags].join(",");
      await prisma.attributeValue.upsert({
        where: { contactId_defId: { contactId, defId: def.id } },
        update: { value },
        create: { contactId, defId: def.id, value },
      });
      return;
    }
    case "add_to_list": {
      if (!action.listId) return;
      await prisma.listMember
        .create({ data: { listId: action.listId, contactId } })
        .catch(() => undefined); // já é membro
      return;
    }
    case "webhook": {
      if (!action.url) return;
      try {
        await fetch(action.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contactId, variables }),
        });
      } catch {
        // falha de webhook externo não interrompe o fluxo
      }
      return;
    }
  }
}
