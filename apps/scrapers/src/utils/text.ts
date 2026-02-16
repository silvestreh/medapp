export function normalizeSpaces(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function normalizeForKey(input: string): string {
  return normalizeSpaces(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function decodeBrokenCharacters(input: string): string {
  return input
    .replace(/[�]/g, ' ')
    .replace(/‑|–|—/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}
