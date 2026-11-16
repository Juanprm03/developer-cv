/** Referencias del CV: datos de terceros fuera del repositorio y solo en el PDF. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCV } from '../src/lib/cv.ts';
import {
  loadReferences,
  maskReferencesInCI,
  parseReferences,
  redactReferences,
  renderReferences,
} from '../src/lib/references.ts';

// Datos ficticios: los reales nunca se versionan.
const sample = `- name: Ada Example
  position: { es: Ingeniera de Software, en: Software Engineer }
  company: Example Corp
  phone: "+57 300 000 0000"
  email: ada@example.com
  consent: true
`;

describe('referencias profesionales', () => {
  it('valida los datos y exige consentimiento', () => {
    expect(parseReferences(sample)).toHaveLength(1);
    expect(() => parseReferences(sample.replace('consent: true', 'consent: false'))).toThrow();
    expect(() => parseReferences(sample.replace('+57 300 000 0000', '3000000000'))).toThrow();
    expect(() => parseReferences(sample.replace('ada@example.com', 'ada'))).toThrow();
  });

  it('se proyecta a cada idioma con enlaces tel: y mailto: funcionales', () => {
    const refs = parseReferences(sample);
    const [es] = renderReferences(refs, 'es');
    const [en] = renderReferences(refs, 'en');
    expect(es).toMatchObject({ position: 'Ingeniera de Software', tel: 'tel:+573000000000' });
    expect(en).toMatchObject({ position: 'Software Engineer', email: 'ada@example.com' });
  });

  it('prioriza el secreto CV_REFERENCES sobre el archivo local', () => {
    expect(loadReferences({ CV_REFERENCES: sample }, '/no/existe')).toHaveLength(1);
    expect(loadReferences({}, '/no/existe')).toEqual([]);
  });

  it('redacta los datos en mensajes y los enmascara en GitHub Actions', () => {
    const refs = parseReferences(sample);
    const msg =
      'falta el enlace tel:+573000000000 y "Ada Example" (+57 300 000 0000, ada@example.com)';
    const out = redactReferences(msg, refs);
    for (const x of ['Ada Example', '+573000000000', '300 000 0000', 'ada@example.com'])
      expect(out).not.toContain(x);
    const lines: string[] = [];
    maskReferencesInCI(refs, { GITHUB_ACTIONS: 'true' }, (l) => lines.push(l));
    expect(lines).toContain('::add-mask::+573000000000');
    expect(lines).toContain('::add-mask::Ada Example');
    maskReferencesInCI(refs, {}, (l) => lines.push(`x${l}`));
    expect(lines.some((l) => l.startsWith('x'))).toBe(false);
  });

  it('el CV resuelto (web, metadatos, JSON-LD) nunca contiene referencias', () => {
    const refs = loadReferences();
    for (const lang of ['es', 'en'] as const) {
      const cv = JSON.stringify(loadCV(lang));
      expect(cv).not.toContain('"references":[');
      for (const r of refs) for (const x of [r.name, r.email, r.phone]) expect(cv).not.toContain(x);
    }
  });

  it('los datos reales no están en archivos versionables', () => {
    expect(readFileSync('.gitignore', 'utf8')).toMatch(/^private\/$/m);
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
    expect(workflow).toMatch(/CV_REFERENCES: \$\{\{ secrets\.CV_REFERENCES \}\}/);
    expect(workflow).toContain('CV_REQUIRE_REFERENCES');
    // El secreto nunca se imprime ni se escribe en archivos desde el workflow.
    expect(workflow).not.toMatch(/(echo|cat|printf|tee).*CV_REFERENCES/);
  });
});
