import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const prepagasSourceAUrl =
  'https://www.sssalud.gob.ar/index.php?page=bus_emp_padron&cat=consultas';
export const prepagasSourceBUrl =
  'https://www.sssalud.gob.ar/?page=listRnosc&tipo=3';
export const anmatUrl =
  'https://servicios.pami.org.ar/vademecum/views/consultaPublica/listado.zul';

export const icd10ChapterUrls = Array.from({ length: 22 }, (_, index) => {
  const chapter = String(index + 1).padStart(2, '0');
  return `https://ais.paho.org/classifications/Chapters/CAP${chapter}.html`;
});

export const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const appRootDir = path.resolve(currentDir, '..');
export const outputDir = path.resolve(appRootDir, 'output');
export const checkpointDir = path.resolve(outputDir, '.checkpoints');

export const defaultDelayMs = 2000;
export const estimatedAnmatLaboratories = 119;
