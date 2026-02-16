import fs from 'node:fs/promises';
import path from 'node:path';
import { checkpointDir } from '../config.js';

export async function readCheckpoint<T>(name: string): Promise<T | null> {
  const filePath = path.resolve(checkpointDir, `${name}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeCheckpoint(name: string, value: unknown): Promise<void> {
  const filePath = path.resolve(checkpointDir, `${name}.json`);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}
