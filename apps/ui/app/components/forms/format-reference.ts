export interface FieldReferenceObject {
  male?: string;
  female?: string;
  child?: string;
  o?: string;
  other?: string;
}

export type FieldReference = string | FieldReferenceObject;

export function formatReference(reference: FieldReference): string {
  if (typeof reference === 'string') return reference;

  const parts: string[] = [];
  if (reference.male) parts.push(`M: ${reference.male}`);
  if (reference.female) parts.push(`F: ${reference.female}`);
  if (reference.child && reference.child !== '–') parts.push(`Niño: ${reference.child}`);
  if (reference.o) parts.push(`Grupo O: ${reference.o}`);
  if (reference.other) parts.push(`Otros: ${reference.other}`);

  return parts.join(' | ');
}
