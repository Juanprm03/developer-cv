/**
 * Comprueba que la salida pública (dist/, lo que se despliega en GitHub Pages) no contiene
 * variantes internas de CV:
 * - los únicos PDF publicados son cv-es.pdf y cv-en.pdf;
 * - ningún archivo ni texto (HTML, XML del sitemap, JS, JSON) menciona un PDF interno,
 *   el directorio private/ o los ids de las variantes internas como archivo de CV;
 * - private/ queda fuera de dist/;
 * - ningún HTML, sitemap, script, SVG, PDF ni la imagen OG contiene nombres internos.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { countConfidential } from '../src/lib/confidential.ts';
import { loadProfile, loadVariants } from '../src/lib/cv.ts';
import { allowedPublicPdfs } from '../src/lib/outputs.ts';
import { loadReferences, referenceTerms } from '../src/lib/references.ts';
import { LANGS } from '../src/lib/schema.ts';

const DIST = 'dist';
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

const all = files(DIST);
const errors: string[] = [];
const internal = loadVariants().filter((v) => !v.public);

const allowedPdfs = new Set(
  allowedPublicPdfs(loadProfile().person.name, LANGS).map((p) => join(DIST, p)),
);
const pdfs = all.filter((f) => f.endsWith('.pdf'));
for (const f of pdfs) if (!allowedPdfs.has(f)) errors.push(`PDF no permitido en dist/: ${f}`);
for (const f of allowedPdfs) if (!pdfs.includes(f)) errors.push(`Falta el CV público ${f}`);

const forbidden = [
  /private\/cv/,
  /cv-[a-z-]+-(es|en)\.pdf/,
  ...internal.map((v) => new RegExp(`cv[-_]${v.id}`, 'i')),
];
for (const f of all) {
  if (forbidden.some((re) => re.test(f))) errors.push(`Archivo interno en dist/: ${f}`);
  if (!/\.(html|xml|txt|json|js|css|svg)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  for (const re of forbidden) if (re.test(text)) errors.push(`${f} menciona ${re}`);
}
// Métricas sin evidencia reproducible (p. ej. la reducción de ~53 s) nunca se publican.
const UNVERIFIED = [/53\s*(s\b|seg|segundos|seconds)/i, /\d+\s*commits/i];
for (const f of all.filter((x) => /\.(html|xml|json|js)$/.test(x)))
  if (UNVERIFIED.some((re) => re.test(readFileSync(f, 'utf8'))))
    errors.push(`${f} contiene una métrica no verificada`);

// Nombres internos de productos, clientes o proveedores (lista con hashes, ver confidential.ts).
for (const f of all.filter((x) => /\.(html|xml|txt|json|js|css|svg)$/.test(x)))
  if (countConfidential(readFileSync(f, 'utf8')) > 0) errors.push(`${f} contiene nombres internos`);
const pdftotext = process.env.PDFTOTEXT ?? 'pdftotext';
for (const f of pdfs)
  try {
    const text = execFileSync(pdftotext, ['-enc', 'UTF-8', f, '-'], { encoding: 'utf8' });
    if (countConfidential(text) > 0) errors.push(`${f} contiene nombres internos`);
    if (UNVERIFIED.some((re) => re.test(text)))
      errors.push(`${f} contiene una métrica no verificada`);
  } catch {
    if (process.env.CI) errors.push(`No se pudo extraer el texto de ${f} (pdftotext)`);
  }
// Referencias de terceros: solo en el TEXTO de los PDF del CV; nunca en la web, el sitemap, los
// scripts, la imagen OG ni los metadatos del PDF.
const refTerms = referenceTerms(loadReferences());
if (refTerms.length) {
  const leaks = (s: string) => refTerms.filter((x) => s.toLowerCase().includes(x.toLowerCase()));
  for (const f of all.filter((x) => !x.endsWith('.pdf'))) {
    const found = leaks(readFileSync(f).toString(f.endsWith('.png') ? 'latin1' : 'utf8'));
    if (found.length) errors.push(`${f} contiene datos de una referencia (${found.length})`);
  }
  for (const f of pdfs) {
    const raw = readFileSync(f).toString('latin1');
    const meta = [...raw.matchAll(/\/(Title|Subject|Keywords|Author|Creator)\s*\(([^)]*)\)/g)]
      .map((m) => m[2])
      .join(' ');
    const xmp = raw.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/)?.[0] ?? '';
    if (leaks(`${meta} ${xmp}`).length)
      errors.push(`${f}: datos de una referencia en los metadatos`);
  }
}

for (const l of LANGS) {
  // La imagen Open Graph se genera desde este JSON: si está limpio, la imagen también.
  const og = `.cache/cv/${loadVariants().find((v) => v.public)?.id}.${l}.json`;
  try {
    if (countConfidential(readFileSync(og, 'utf8')) > 0)
      errors.push(`${og} (OG) contiene nombres internos`);
  } catch {}
}

for (const f of all.filter((x) => x.endsWith('.xml'))) {
  if (/\.pdf</.test(readFileSync(f, 'utf8'))) errors.push(`${f}: el sitemap no debe listar PDF`);
}

if (errors.length) {
  console.error(`✗ Salida pública con contenido interno\n\n${[...new Set(errors)].join('\n')}`);
  process.exit(1);
}
console.log(
  `✓ Salida pública: ${all.length} archivos, solo ${[...allowedPdfs].map((f) => f.slice(DIST.length + 1)).join(' y ')} como CV; ${internal.length} variantes internas excluidas`,
);
