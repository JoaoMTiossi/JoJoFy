/**
 * Seed de demonstração — expandido no M10 com conta completa (contatos,
 * listas, segmentos, templates, campanha, jornada, fluxo de bot, filas e
 * conversas). Por enquanto garante que o schema está aplicado.
 */
import { prisma } from "./lib/prisma";

async function main() {
  const count = await prisma.account.count();
  console.log(`[seed] contas existentes: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
