import { prisma } from '../prisma';

export async function listCustomFieldDefinitions(workspaceId: string) {
  return prisma.customFieldDefinition.findMany({
    where: { workspaceId },
    orderBy: { label: 'asc' },
  });
}

export async function getDocumentCustomFields(documentId: string) {
  return prisma.customFieldValue.findMany({
    where: { documentId },
    include: { definition: true },
  });
}

export async function upsertCustomFieldValue(input: {
  documentId: string;
  definitionId: string;
  value?: string | null;
  editedValue?: string | null;
  confidence?: number | null;
}) {
  return prisma.customFieldValue.upsert({
    where: {
      documentId_definitionId: {
        documentId: input.documentId,
        definitionId: input.definitionId,
      },
    },
    update: {
      value: input.value ?? null,
      editedValue: input.editedValue ?? null,
      confidence: input.confidence ?? null,
    },
    create: {
      id: crypto.randomUUID(),
      documentId: input.documentId,
      definitionId: input.definitionId,
      value: input.value ?? null,
      editedValue: input.editedValue ?? null,
      confidence: input.confidence ?? null,
    },
  });
}