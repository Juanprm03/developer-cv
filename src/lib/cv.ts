/**
 * Carga y valida los datos (perfil, etiquetas y variantes) y resuelve CVs.
 * Memoizado: cada archivo se lee y valida una sola vez por proceso.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { type Profile, profileSchema } from './profile-schema.ts';
import { type LabelsByLang, resolveCV } from './resolve.ts';
import { type CV, cvSchema, type Lang } from './schema.ts';
import { type Variant, variantSchema } from './variant-schema.ts';

export const DATA_DIR = resolve(process.cwd(), 'data');
export const labelsSchema = cvSchema.shape.meta.shape.labels;
/** data/labels.yaml: etiquetas de interfaz del CV, con las mismas claves en cada idioma. */
export const labelsByLangSchema = z.strictObject({ es: labelsSchema, en: labelsSchema });

/** Lee un YAML y lo valida; lanza un error legible con la ruta de cada problema. */
export function readYaml<T extends z.ZodType>(file: string, schema: T): z.output<T> {
  const raw: unknown = parse(readFileSync(file, 'utf8'));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n');
    throw new Error(`${file.replace(`${process.cwd()}/`, '')} no es válido:\n${issues}`);
  }
  return result.data;
}

const cache = new Map<string, unknown>();
const memo = <T>(key: string, fn: () => T): T => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key) as T;
};

export const loadProfile = (): Profile =>
  memo('profile', () => readYaml(resolve(DATA_DIR, 'profile.yaml'), profileSchema));

export const loadLabels = (): LabelsByLang =>
  memo('labels', () => readYaml(resolve(DATA_DIR, 'labels.yaml'), labelsByLangSchema));

/** Todas las variantes, ordenadas por `order`. */
export const loadVariants = (): Variant[] =>
  memo('variants', () => {
    const dir = resolve(DATA_DIR, 'variants');
    const variants = readdirSync(dir)
      .filter((f) => f.endsWith('.yaml'))
      .map((f) => {
        const v = readYaml(resolve(dir, f), variantSchema);
        if (`${v.id}.yaml` !== f)
          throw new Error(`variants/${f}: el id debe ser "${f.slice(0, -5)}"`);
        return v;
      })
      .sort((a, b) => a.order - b.order);
    const defaults = variants.filter((v) => v.default);
    if (defaults.length !== 1)
      throw new Error(`Debe haber exactamente una variante default (hay ${defaults.length})`);
    const publics = variants.filter((v) => v.public);
    if (publics.length !== 1 || !publics[0]?.default)
      throw new Error('Solo la variante default puede ser pública (y debe serlo)');
    return variants;
  });

export const defaultVariant = (): Variant => {
  const v = loadVariants().find((x) => x.default);
  if (!v) throw new Error('Sin variante default');
  return v;
};

/** CV resuelto de un idioma. Sin variante: la variante por defecto (la de la web). */
export function loadCV(lang: Lang, variantId?: string): CV {
  return memo(`cv:${variantId ?? 'default'}:${lang}`, () => {
    const variant = variantId ? loadVariants().find((v) => v.id === variantId) : defaultVariant();
    if (!variant) throw new Error(`Variante desconocida "${variantId}"`);
    return resolveCV({ profile: loadProfile(), variant, labels: loadLabels(), lang });
  });
}
