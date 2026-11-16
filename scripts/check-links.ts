/**
 * Comprueba los enlaces internos del sitio generado (dist/):
 * - cada href/src interno apunta a un archivo existente (página, PDF, imagen…);
 * - cada ancla (#id) existe en la página de destino;
 * - las URL absolutas del propio sitio (canonical, hreflang, og:image, JSON-LD) también.
 * Los enlaces externos (otros dominios, mailto:, tel:) no se comprueban: requerirían red.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const base = (process.env.BASE_PATH ?? '/developer-cv').replace(/\/$/, '');
const site = (process.env.SITE ?? 'https://juanprm03.github.io').replace(/\/$/, '');

const pages = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : p.endsWith('.html') ? [p] : [];
  });

const ids = new Map<string, Set<string>>();
const idsOf = (file: string) => {
  let set = ids.get(file);
  if (!set) {
    set = new Set(
      [...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? ''),
    );
    ids.set(file, set);
  }
  return set;
};

/** Ruta de sitio (/developer-cv/x/) → archivo en dist. */
const toFile = (pathname: string): string | undefined => {
  if (!pathname.startsWith(`${base}/`) && pathname !== base) return undefined;
  const rel = decodeURIComponent(pathname.slice(base.length)) || '/';
  const candidates = rel.endsWith('/')
    ? [join(DIST, rel, 'index.html')]
    : [join(DIST, rel), join(DIST, rel, 'index.html'), join(DIST, `${rel}.html`)];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile());
};

const errors: string[] = [];
let checked = 0;
const all = pages(DIST);
for (const page of all) {
  const html = readFileSync(page, 'utf8');
  const refs = [
    ...[...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1] ?? ''),
    ...[...html.matchAll(/(?:content|"url"|"image"):?\s*=?\s*"(https?:\/\/[^"]+)"/g)].map(
      (m) => m[1] ?? '',
    ),
  ];
  const pageUrl = new URL(
    `${site}${base}/${page.slice(DIST.length + 1).replace(/index\.html$/, '')}`,
  );
  for (const ref of new Set(refs)) {
    if (/^(mailto:|tel:|data:|javascript:)/.test(ref)) continue;
    const url = new URL(ref, pageUrl);
    if (url.origin !== site) continue; // externo
    checked++;
    const file = url.pathname === pageUrl.pathname ? page : toFile(url.pathname);
    if (!file) {
      errors.push(`${page}: enlace roto ${ref}`);
      continue;
    }
    if (
      url.hash &&
      file.endsWith('.html') &&
      !idsOf(file).has(decodeURIComponent(url.hash.slice(1)))
    )
      errors.push(`${page}: el ancla ${url.hash} no existe en ${file}`);
  }
}

if (errors.length) {
  console.error(`✗ Enlaces internos rotos\n\n${[...new Set(errors)].join('\n')}`);
  process.exit(1);
}
console.log(`✓ ${checked} enlaces internos verificados en ${all.length} páginas`);
