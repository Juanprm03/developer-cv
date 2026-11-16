/** Casos de estudio con flujo funcional: estructura común, paridad ES/EN y abstracción. */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = 'src/content/projects';
const SECTIONS = {
  es: [
    'Problema',
    'Solución',
    'Flujo funcional',
    'Arquitectura conceptual',
    'Mi contribución',
    'Stack',
    'Retos técnicos',
    'Resultados verificables',
  ],
  en: [
    'Problem',
    'Solution',
    'Functional flow',
    'Conceptual architecture',
    'My contribution',
    'Stack',
    'Technical challenges',
    'Verifiable results',
  ],
} as const;
const PRIORITY = [
  'ticketing-ecosystem',
  'payments-platform',
  'conversational-platform',
  'modular-erp',
  'ai-backend',
];

const read = (lang: string, f: string) => readFileSync(`${dir}/${lang}/${f}.mdx`, 'utf8');
const headings = (src: string) => [...src.matchAll(/^## (.+)$/gm)].map((m) => m[1]?.trim());
const flows = (src: string) =>
  [...src.matchAll(/<Flow\b[^>]*steps=\{(\[[\s\S]*?\])\}\s*\/>/g)].map(
    (m) => JSON.parse(m[1] ?? '[]') as { title: string; text: string; actor?: string }[],
  );
const withFlow = readdirSync(`${dir}/es`)
  .map((f) => f.replace(/\.mdx$/, ''))
  .filter((f) => read('es', f).includes('<Flow'));

describe('casos de estudio con flujo', () => {
  it('los casos prioritarios tienen flujo funcional', () => {
    expect(withFlow).toEqual(expect.arrayContaining(PRIORITY));
  });

  for (const slug of withFlow)
    for (const lang of ['es', 'en'] as const)
      it(`${slug} (${lang}) sigue las 8 secciones en orden`, () => {
        expect(headings(read(lang, slug))).toEqual([...SECTIONS[lang]]);
      });

  for (const slug of withFlow)
    it(`${slug}: mismo flujo (etapas y actores) en ES y EN`, () => {
      const [es, en] = [flows(read('es', slug)), flows(read('en', slug))];
      expect(es.map((f) => f.length)).toEqual(en.map((f) => f.length));
      expect(es.flat().map((s) => Boolean(s.actor))).toEqual(
        en.flat().map((s) => Boolean(s.actor)),
      );
    });

  it('las etapas son abstracciones: sin endpoints, URLs, credenciales ni variables de entorno', () => {
    const steps = withFlow.flatMap((s) =>
      [...flows(read('es', s)), ...flows(read('en', s))].flat(),
    );
    expect(steps.length).toBeGreaterThan(20);
    for (const s of steps) {
      const text = `${s.title} ${s.text} ${s.actor ?? ''}`;
      expect(text).not.toMatch(
        /https?:\/\/|\/api\/|\/v\d\/|[A-Z][A-Z0-9]*_[A-Z0-9_]+|api[_-]?key\s*[:=]|secret|token\s*[:=]/i,
      );
      expect(s.text.length).toBeGreaterThan(30);
      expect(s.title.length).toBeLessThanOrEqual(24);
    }
  });
});

describe('estado y alcance confirmados por el propietario', async () => {
  const { loadCV, loadProfile } = await import('../src/lib/cv.ts');
  const profile = loadProfile();

  it('el backend de IA figura con desarrollo detenido, nunca en producción', () => {
    const p = profile.projects.find((x) => x.id === 'ai-backend');
    expect(p?.status).toBe('stopped');
    for (const lang of ['es', 'en'] as const) {
      const src = read(lang, 'ai-backend');
      expect(src).toMatch(lang === 'es' ? /desarrollo detenido/i : /development halted/i);
      // Ninguna afirmación de producción, salvo el aviso explícito de que no lo está.
      const claims = src.replace(/^.*(no se presenta|not presented).*$/gm, '');
      expect(claims).not.toMatch(/en producción|in production/i);
    }
  });

  it('MCP solo aparece como trabajo en desarrollo', () => {
    for (const lang of ['es', 'en'] as const) {
      const cv = JSON.stringify(loadCV(lang));
      expect(cv).not.toMatch(/Model Context Protocol|\bMCP\b/);
      const ops = read(lang, 'operations-platform');
      for (const line of ops.split('\n').filter((l) => /\bMCP\b/.test(l) && !l.startsWith('{/*')))
        expect(line).toMatch(lang === 'es' ? /en desarrollo/i : /in development/i);
    }
  });
});
