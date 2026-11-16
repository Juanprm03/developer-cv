/**
 * Referencias profesionales del CV público.
 *
 * Son datos personales de TERCEROS: nunca se versionan ni llegan a la web. Se leen de
 *   1. la variable de entorno CV_REFERENCES (YAML o JSON; en CI, un secreto del repositorio), o
 *   2. private/references.yaml (gitignored) en local.
 * Solo scripts/build-pdf.ts las inyecta en el JSON de Typst de la variante con `referencesNote`;
 * no forman parte de cvSchema, así que Astro (web, metadatos, JSON-LD) no puede mostrarlas.
 * Sin datos, el PDF muestra "Referencias profesionales disponibles a solicitud".
 */
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import type { Lang } from './schema.ts';

export const REFERENCES_FILE = 'private/references.yaml';

const text = z.string().trim().min(1);
const localized = z.strictObject({ es: text, en: text });

export const referenceSchema = z.strictObject({
  name: text,
  position: localized,
  company: text,
  /** Formato internacional, p. ej. "+57 300 000 0000". */
  phone: z.string().regex(/^\+\d[\d ]{7,18}\d$/, 'teléfono en formato internacional'),
  email: z.email(),
  /** Confirmación de que la persona autorizó figurar como referencia. */
  consent: z.literal(true),
});
export const referencesSchema = z.array(referenceSchema).max(3);
export type Reference = z.infer<typeof referenceSchema>;

/** Referencia proyectada a un idioma, tal como la consume typst/cv.typ. */
export interface RenderedReference {
  name: string;
  position: string;
  company: string;
  phone: string;
  tel: string;
  email: string;
}

export function parseReferences(source: string): Reference[] {
  return referencesSchema.parse(parse(source));
}

/** Referencias disponibles en este entorno (o [] si no hay ninguna configurada). */
export function loadReferences(env = process.env, file = REFERENCES_FILE): Reference[] {
  const source = env.CV_REFERENCES?.trim() || (existsSync(file) ? readFileSync(file, 'utf8') : '');
  return source ? parseReferences(source) : [];
}

export const renderReferences = (refs: Reference[], lang: Lang): RenderedReference[] =>
  refs.map((r) => ({
    name: r.name,
    position: r.position[lang],
    company: r.company,
    phone: r.phone,
    tel: `tel:${r.phone.replaceAll(' ', '')}`,
    email: r.email,
  }));

/** Fragmentos identificables de cada referencia (también en las formas que derivan los scripts). */
export const referenceTerms = (refs: Reference[]): string[] => [
  ...new Set(
    refs.flatMap((r) => [
      r.name,
      r.company,
      r.position.es,
      r.position.en,
      r.email,
      r.phone,
      r.phone.replaceAll(' ', ''),
      r.phone.replace(/^\+\d{1,3}\s*/, ''),
      `tel:${r.phone.replaceAll(' ', '')}`,
      `mailto:${r.email}`,
    ]),
  ),
];

/** Sustituye los datos de las referencias por un marcador (para mensajes de error y logs). */
export function redactReferences(text: string, refs: Reference[]): string {
  return referenceTerms(refs)
    .sort((a, b) => b.length - a.length)
    .reduce((acc, term) => acc.split(term).join('[referencia]'), text);
}

/**
 * En GitHub Actions, registra cada fragmento como máscara: el runner enmascara el valor completo
 * del secreto, pero no las formas derivadas (p. ej. el teléfono sin espacios). El comando
 * `::add-mask::` lo consume el runner y no aparece en el log.
 */
export function maskReferencesInCI(refs: Reference[], env = process.env, out = console.log): void {
  if (env.GITHUB_ACTIONS !== 'true') return;
  for (const term of referenceTerms(refs)) out(`::add-mask::${term}`);
}
