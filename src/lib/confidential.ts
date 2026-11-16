/**
 * Detección de nombres internos (productos, clientes y proveedores) que no deben publicarse.
 *
 * Solo se guardan hashes SHA-256 (16 primeros caracteres hex) de los términos en minúsculas y
 * sin tildes: el repositorio es público y la lista no debe revelar los nombres que protege.
 * Se comparan palabras sueltas y pares de palabras consecutivas.
 */
import { createHash } from 'node:crypto';

export const CONFIDENTIAL_HASHES: ReadonlySet<string> = new Set([
  'c5f4d81960ea6ef4',
  '14ae3ff06bf33e59',
  '6fd3ee405dfed5e8',
  '2b13bc24016fd662',
  '9d3668c76a44d2aa',
  '1faa59487b2dbb19',
  '87f989d664849384',
  '194235f0e6df7731',
  '603dc020b04ee95b',
  'cff63f57a38d9484',
  'f5e33862a28cb3fe',
  'd134e68367839d0b',
  'fa23251c1806725a',
  '448afb980975ce98',
  '0e06f07b457a9613',
  '802456e1b5a3ad4f',
  '59d0d8c121804f84',
]);

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export const normalizeText = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Decodifica secuencias %XX (p. ej. SVG en data URI) sin fallar con texto que no lo sea. */
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s.replace(/%([0-9a-f]{2})/gi, (_, h: string) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    );
  }
};

/** Número de apariciones de términos confidenciales en un texto (0 = limpio). */
export function countConfidential(text: string): number {
  const words = normalizeText(decode(text))
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let hits = 0;
  for (let i = 0; i < words.length; i++) {
    if (CONFIDENTIAL_HASHES.has(hash(words[i] ?? ''))) hits++;
    if (i + 1 < words.length && CONFIDENTIAL_HASHES.has(hash(`${words[i]} ${words[i + 1]}`)))
      hits++;
  }
  return hits;
}
