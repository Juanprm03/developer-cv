/**
 * Genera los PDF con Typst a partir del CV resuelto (el mismo que consume la web).
 *
 * - Internos: private/cv/cv-<variante>-<lang>.pdf para TODAS las variantes (postulaciones).
 * - Públicos: public/cv-<lang>.pdf, copia de la variante pública (General Fullstack).
 * - public/og-<lang>.png: imagen para redes sociales.
 *
 * Falla si un PDF supera el `maxPages` de su variante. Elimina de public/ cualquier PDF de
 * variante que no sea público. Uso: `node scripts/build-pdf.ts [variante…]`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { loadCV, loadProfile, loadVariants } from '../src/lib/cv.ts';
import { PRIVATE_DIR, pdfTargets } from '../src/lib/outputs.ts';
import { loadReferences, maskReferencesInCI, renderReferences } from '../src/lib/references.ts';
import { LANGS } from '../src/lib/schema.ts';

const CACHE = '.cache/cv';
const common = ['--root', '.', '--font-path', 'typst/fonts', '--ignore-system-fonts'];
const only = process.argv.slice(2);
const variants = loadVariants();
// Referencias de terceros: fuera del repositorio (secreto CV_REFERENCES o private/references.yaml).
const references = loadReferences();
maskReferencesInCI(references);
// En el despliegue (CV_REQUIRE_REFERENCES=1) el secreto es obligatorio: sin él, falla en lugar de
// publicar en silencio el CV sin la referencia.
if (process.env.CV_REQUIRE_REFERENCES === '1' && !references.length) {
  console.error('✗ Falta el secreto CV_REFERENCES (referencias del CV público).');
  process.exit(1);
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(PRIVATE_DIR, { recursive: true });
mkdirSync('public', { recursive: true });

// Ningún PDF de variante puede quedar en public/ (solo cv-es.pdf / cv-en.pdf).
for (const f of readdirSync('public')) if (/^cv-.+-(es|en)\.pdf$/.test(f)) rmSync(`public/${f}`);

let failed = false;
for (const t of pdfTargets(variants, LANGS, loadProfile().person.name)) {
  if (only.length && !only.includes(t.variant)) continue;
  const variant = variants.find((v) => v.id === t.variant);
  if (!variant) continue;
  const cv = loadCV(t.lang, t.variant);
  const data = `${CACHE}/${t.variant}.${t.lang}.json`;
  // Solo el PDF las recibe (la web nunca): se añaden al JSON de Typst, fuera de cvSchema.
  const pdfData = cv.meta.referencesNote
    ? { ...cv, references: renderReferences(references, t.lang) }
    : cv;
  writeFileSync(data, `${JSON.stringify(pdfData, null, 2)}\n`);
  const input = ['--input', `data=/${data}`];

  execFileSync('typst', ['compile', ...common, ...input, 'typst/cv.typ', t.file], {
    stdio: 'inherit',
  });
  const pages = Number(
    execFileSync(
      'typst',
      ['eval', ...common, ...input, '--in', 'typst/cv.typ', 'query(<page-count>).first().value'],
      { encoding: 'utf8' },
    ).trim(),
  );
  const ok = pages <= variant.maxPages;
  failed ||= !ok;
  console.log(
    `${ok ? '✓' : '✗'} ${t.file} · ${pages} página(s)${ok ? '' : ` (máximo ${variant.maxPages})`}`,
  );

  if (t.publicFiles.length) {
    for (const f of t.publicFiles) copyFileSync(t.file, f);
    execFileSync('typst', [
      'compile',
      ...common,
      ...input,
      '--format',
      'png',
      '--ppi',
      '72',
      'typst/og.typ',
      `public/og-${t.lang}.png`,
    ]);
    console.log(`  ↳ público: ${t.publicFiles.join(' · ')} · public/og-${t.lang}.png`);
  }
}
if (!references.length && variants.some((v) => v.referencesNote))
  console.warn(
    '⚠ Sin referencias configuradas (CV_REFERENCES o private/references.yaml): el CV muestra la nota "disponibles a solicitud".',
  );
if (failed) process.exit(1);
