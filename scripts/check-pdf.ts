/**
 * Verifica los PDF generados como lo haría un ATS:
 * - el texto se extrae con `pdftotext` (poppler) y contiene nombre, email, encabezados,
 *   empresas y cada logro y descripción LITERALES del CV resuelto;
 * - los enlaces (mailto, perfiles, sitio, proyectos públicos) son anotaciones clicables;
 * - los PDF públicos cv-<lang>.pdf son idénticos a la variante pública (interna en private/cv/);
 * - la compilación es reproducible (mismo PDF en dos compilaciones);
 * - en modo release (CV_RELEASE=1) no quedan placeholders ni TODO.
 *
 * `pdftotext` se toma de $PDFTOTEXT o del PATH. En CI es obligatorio; en local, si no está
 * instalado, se avisa y se omiten las comprobaciones de texto.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadCV, loadProfile, loadVariants } from '../src/lib/cv.ts';
import { PLACEHOLDER_PATTERNS } from '../src/lib/integrity.ts';
import { pdfTargets } from '../src/lib/outputs.ts';
import {
  loadReferences,
  maskReferencesInCI,
  redactReferences,
  renderReferences,
} from '../src/lib/references.ts';
import { type CV, LANGS } from '../src/lib/schema.ts';

const release = process.env.CV_RELEASE === '1';
const pdftotext = process.env.PDFTOTEXT ?? 'pdftotext';
const errors: string[] = [];
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

const hasPdftotext = (() => {
  try {
    execFileSync(pdftotext, ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (!hasPdftotext) {
  const msg = `pdftotext no está disponible (instala poppler-utils o define PDFTOTEXT)`;
  if (process.env.CI) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  }
  console.warn(`⚠ ${msg}: se omiten las comprobaciones de texto.`);
}

/** Texto plano esperado: sin marcas **negrita** y con espacios normalizados. */
const plain = (s: string) =>
  s.replaceAll('**', '').replace(/\s+/g, ' ').replace(/\/ /g, '/').trim();

const references = loadReferences();
maskReferencesInCI(references);
const refsFor = (cv: CV) =>
  cv.meta.referencesNote ? renderReferences(references, cv.meta.lang) : [];

function expectedTexts(cv: CV): string[] {
  const L = cv.meta.labels;
  const refs = refsFor(cv);
  return [
    cv.basics.name,
    cv.basics.email,
    ...(cv.basics.phone ? [cv.basics.phone] : []),
    L.summary,
    L.work,
    L.skills,
    L.education,
    L.languages,
    ...(cv.projects.length ? [cv.meta.featuredProjects ? L.featuredProjects : L.projects] : []),
    ...(cv.meta.referencesNote ? [L.references] : []),
    ...(cv.meta.referencesNote && !refs.length ? [L.referencesNote] : []),
    ...refs.flatMap((r) => [r.name, r.position, r.company, r.phone, r.email]),
    ...(cv.knowledge.length ? [L.knowledge, ...cv.knowledge.map((k) => k.name)] : []),
    ...cv.work.flatMap((w) => [w.name, w.position, ...w.highlights]),
    ...cv.projects.flatMap((p) => [p.name, p.description, ...p.highlights]),
    plain(cv.basics.summary),
  ].map(plain);
}

function expectedLinks(cv: CV): string[] {
  return [
    `mailto:${cv.basics.email}`,
    ...(cv.basics.phone ? [`tel:${cv.basics.phone.replaceAll(' ', '')}`] : []),
    ...cv.basics.profiles.map((p) => p.url),
    ...(cv.basics.url ? [cv.basics.url] : []),
    ...cv.projects.flatMap((p) => (p.url ? [p.url] : [])),
    ...refsFor(cv).flatMap((r) => [r.tel, `mailto:${r.email}`]),
  ];
}

let checked = 0;
const variants = loadVariants();
for (const t of pdfTargets(variants, LANGS, loadProfile().person.name)) {
  const cv = loadCV(t.lang, t.variant, 'pdf');
  const file = t.file;
  const where = file;
  let raw: Buffer;
  try {
    raw = readFileSync(file);
  } catch {
    errors.push(`${where}: no existe (ejecuta pnpm pdf)`);
    continue;
  }

  const annotations = raw.toString('latin1');
  for (const url of expectedLinks(cv))
    if (
      !new RegExp(`/URI\\s*\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`).test(annotations)
    )
      errors.push(`${where}: falta el enlace ${url}`);

  if (hasPdftotext) {
    const text = execFileSync(pdftotext, ['-enc', 'UTF-8', file, '-'], { encoding: 'utf8' });
    // Comparación sin distinguir mayúsculas: los encabezados se muestran en versalitas.
    const flat = plain(text).toLocaleLowerCase(t.lang);
    for (const x of expectedTexts(cv))
      if (!flat.includes(x.toLocaleLowerCase(t.lang)))
        errors.push(`${where}: texto no extraíble: "${x.slice(0, 70)}…"`);
    if (release && PLACEHOLDER_PATTERNS.some((re) => re.test(text)))
      errors.push(`${where}: contiene placeholders o TODO (modo release)`);
    // Encabezados legibles para ATS: sin letras separadas ("P E R F I L").
    if (/\b(?:[A-ZÁÉÍÓÚÑ] ){4,}[A-ZÁÉÍÓÚÑ]\b/.test(text))
      errors.push(`${where}: encabezados con letras separadas (tracking) en el texto extraído`);
    // CV público: dos páginas bien repartidas (la segunda no puede quedar casi vacía).
    if (t.publicFiles.length) {
      const pageText = (n: number) => {
        try {
          return execFileSync(
            pdftotext,
            ['-enc', 'UTF-8', '-f', String(n), '-l', String(n), file, '-'],
            {
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'ignore'],
            },
          ).trim();
        } catch {
          return ''; // la página no existe
        }
      };
      const second = pageText(2);
      const [p1, p2, p3] = [pageText(1).length, second.length, pageText(3).length];
      // Continuidad: la página 2 no empieza con viñetas sin encabezado.
      if (second.startsWith('■'))
        errors.push(`${where}: la página 2 empieza con viñetas sin encabezado`);
      // MCP sigue en desarrollo y sin implementación verificada: no se presenta como habilidad.
      if (/Model Context Protocol|\bMCP\b/.test(text))
        errors.push(`${where}: menciona MCP, que no está verificado como funcionalidad`);
      if (!p2 || p3) errors.push(`${where}: el CV público debe ocupar exactamente 2 páginas`);
      else if (p2 / p1 < 0.4)
        errors.push(
          `${where}: página 2 con poco contenido (${Math.round((p2 / p1) * 100)} % de la 1)`,
        );
    }
  }

  for (const pub of t.publicFiles)
    if (sha(pub) !== sha(file)) errors.push(`${pub} no es idéntico a ${file}`);
  checked++;
}

// Reproducibilidad: recompilar la variante por defecto debe dar exactamente el mismo PDF.
const def = variants.find((v) => v.default);
if (def) {
  const repro = '.cache/cv/repro.pdf';
  execFileSync('typst', [
    'compile',
    '--root',
    '.',
    '--font-path',
    'typst/fonts',
    '--ignore-system-fonts',
    '--input',
    `data=/.cache/cv/${def.id}.es.json`,
    'typst/cv.typ',
    repro,
  ]);
  if (sha(repro) !== sha(`private/cv/cv-${def.id}-es.pdf`))
    errors.push('La compilación no es reproducible: dos builds producen PDF distintos');
}

if (errors.length) {
  // Los mensajes nunca muestran datos de las referencias (llegan a los logs de CI).
  console.error(
    `✗ Verificación de PDF fallida\n\n${redactReferences(errors.join('\n'), references)}`,
  );
  process.exit(1);
}
console.log(
  `✓ ${checked} PDF verificados${hasPdftotext ? ' (texto con pdftotext, enlaces, alias y reproducibilidad)' : ' (enlaces, alias y reproducibilidad)'}${release ? ' · modo release' : ''}`,
);
