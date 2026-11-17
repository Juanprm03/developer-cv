/**
 * Valida los datos y regenera los JSON Schema del editor.
 *
 * - data/profile.yaml, data/labels.yaml y data/variants/*.yaml contra sus esquemas Zod
 *   (incluye integridad referencial y cronología del perfil).
 * - Cada variante: referencias, textos libres sin tecnologías ni cifras ajenas al perfil,
 *   y resolución completa a `cvSchema` en todos los idiomas.
 * - Casos de estudio: un MDX por idioma para cada proyecto con caseStudy, paridad ES/EN
 *   de diagramas y texto alternativo (accTitle/accDescr) en cada diagrama Mermaid.
 * - `--release` (o CV_RELEASE=1): además falla si queda algún placeholder o TODO.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { labelsByLangSchema, loadCV, loadProfile, loadVariants } from '../src/lib/cv.ts';
import { checkCaseStudies, checkVariantFreeText, findPlaceholders } from '../src/lib/integrity.ts';
import { profileSchema } from '../src/lib/profile-schema.ts';
import { validateVariant } from '../src/lib/resolve.ts';
import { LANGS } from '../src/lib/schema.ts';
import { variantSchema } from '../src/lib/variant-schema.ts';

const release = process.argv.includes('--release') || process.env.CV_RELEASE === '1';

mkdirSync('schema', { recursive: true });
rmSync('schema/cv.schema.json', { force: true }); // contrato de salida: ya no se edita a mano
for (const [name, schema] of [
  ['profile', profileSchema],
  ['variant', variantSchema],
  ['labels', labelsByLangSchema],
] as const)
  writeFileSync(
    `schema/${name}.schema.json`,
    `${JSON.stringify(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }), null, 2)}\n`,
  );

const errors: string[] = [];
const attempt = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch (e) {
    errors.push((e as Error).message);
    return undefined;
  }
};

const profile = attempt(loadProfile);
const variants = attempt(loadVariants) ?? [];

if (profile) {
  for (const variant of variants) {
    errors.push(...validateVariant(profile, variant), ...checkVariantFreeText(profile, variant));
    for (const lang of LANGS) {
      for (const target of ['web', 'pdf'] as const) {
        const cv = attempt(() => loadCV(lang, variant.id, target));
        if (cv && release)
          errors.push(
            ...findPlaceholders(cv).map(
              (p) => `[release] ${variant.id}.${lang} (${target}) contiene ${p}`,
            ),
          );
      }
    }
  }
}

// Casos de estudio.
const projectsDir = 'src/content/projects';
const files = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    readdirSync(`${projectsDir}/${lang}`)
      .filter((f) => f.endsWith('.mdx'))
      .sort(),
  ]),
);
if (profile) errors.push(...checkCaseStudies(profile, files));

// Paridad ES/EN de diagramas y accesibilidad: cada diagrama Mermaid necesita accDescr
// (rehype-mermaid lo usa como texto alternativo del <img>).
const diagrams = (lang: string, file: string) =>
  [
    ...readFileSync(`${projectsDir}/${lang}/${file}`, 'utf8').matchAll(
      /```mermaid\n([\s\S]*?)```/g,
    ),
  ].map((m) => m[1] ?? '');
for (const lang of LANGS)
  for (const f of files[lang] ?? [])
    diagrams(lang, f).forEach((d, i) => {
      if (!/^\s*accDescr\s*:/m.test(d))
        errors.push(`${lang}/${f}: el diagrama ${i + 1} no tiene accDescr (texto alternativo)`);
      if (!/^\s*accTitle\s*:/m.test(d))
        errors.push(`${lang}/${f}: el diagrama ${i + 1} no tiene accTitle`);
    });
const [refLang, ...restLangs] = LANGS;
for (const lang of restLangs)
  for (const f of files[refLang] ?? [])
    if (files[lang]?.includes(f)) {
      const a = diagrams(refLang, f).length;
      const b = diagrams(lang, f).length;
      if (a !== b) errors.push(`Caso ${f}: ${refLang} tiene ${a} diagramas y ${lang} ${b}`);
    }
// Paridad de flujos funcionales: mismo número de <Flow> y de etapas en cada idioma.
const flows = (lang: string, file: string) => {
  const src = readFileSync(`${projectsDir}/${lang}/${file}`, 'utf8');
  return [...src.matchAll(/<Flow\b[^>]*steps=\{(\[[\s\S]*?\])\}\s*\/>/g)].map(
    (m) => (m[1]?.match(/"title":/g) ?? []).length,
  );
};
for (const lang of restLangs)
  for (const f of files[refLang] ?? [])
    if (files[lang]?.includes(f)) {
      const a = flows(refLang, f).join(',');
      const b = flows(lang, f).join(',');
      if (a !== b) errors.push(`Caso ${f}: flujos ${refLang} [${a}] ≠ ${lang} [${b}]`);
    }

const featured = (files[refLang] ?? []).filter((f) =>
  /^featured:\s*true/m.test(readFileSync(`${projectsDir}/${refLang}/${f}`, 'utf8')),
);
if (featured.length > 3) errors.push(`Máximo 3 casos destacados (hay ${featured.length})`);
if (release)
  for (const lang of LANGS)
    for (const f of files[lang] ?? [])
      errors.push(
        ...findPlaceholders(readFileSync(`${projectsDir}/${lang}/${f}`, 'utf8')).map(
          () => `[release] ${lang}/${f} contiene placeholders o TODO`,
        ),
      );

// Afirmaciones pendientes de revisión del propietario: no se renderizan (comentarios MDX)
// ni bloquean el build, pero se listan para que no se olviden.
const reviews = LANGS.flatMap((lang) =>
  (files[lang] ?? []).flatMap((f) =>
    [
      ...readFileSync(`${projectsDir}/${lang}/${f}`, 'utf8').matchAll(/REVISAR:\s*([^*]+)\*\//g),
    ].map((m) => `${lang}/${f}: ${(m[1] ?? '').trim()}`),
  ),
);
for (const r of reviews) console.warn(`⚠ Pendiente de revisión · ${r}`);

if (errors.length) {
  console.error(`✗ Validación fallida\n\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(
  `✓ Datos válidos: ${variants.length} variantes × ${LANGS.length} idiomas${release ? ' · modo release sin placeholders' : ''}`,
);
