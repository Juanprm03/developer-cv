/**
 * Invariantes sobre los datos REALES: todas las variantes × idiomas.
 * Garantizan que ninguna variante invente o altere información del perfil maestro.
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCV, loadProfile, loadVariants } from '../src/lib/cv.ts';
import { checkCaseStudies, checkVariantFreeText } from '../src/lib/integrity.ts';
import { validateVariant } from '../src/lib/resolve.ts';
import { LANGS } from '../src/lib/schema.ts';

const profile = loadProfile();
const variants = loadVariants();
const cases = variants.flatMap((v) => LANGS.map((lang) => ({ v, lang, cv: loadCV(lang, v.id) })));
const nonProfessional = new Set(
  profile.skills.filter((s) => s.context !== 'professional').map((s) => s.name),
);

describe('variantes del portafolio', () => {
  it('incluye las variantes obligatorias y la opcional Java/Spring Boot', () => {
    expect(variants.map((v) => v.id)).toEqual([
      'general',
      'backend-python',
      'backend-node',
      'ai-developer',
      'java-spring',
    ]);
    expect(variants.filter((v) => v.default).map((v) => v.id)).toEqual(['general']);
    expect(variants.find((v) => v.id === 'java-spring')?.optional).toBe(true);
  });

  it.each(variants.map((v) => [v.id, v] as const))(
    '%s: referencias y textos libres válidos',
    (_, v) => {
      expect(validateVariant(profile, v)).toEqual([]);
      expect(checkVariantFreeText(profile, v)).toEqual([]);
    },
  );
});

describe.each(cases.map((c) => [`${c.v.id}.${c.lang}`, c] as const))('%s', (_, { v, lang, cv }) => {
  it('conserva todos los empleos con sus hechos exactos y en orden', () => {
    expect(cv.work.map((w) => [w.name, w.startDate, w.endDate])).toEqual(
      profile.work.map((w) => [w.company, w.startDate, w.endDate]),
    );
    cv.work.forEach((w, i) => {
      expect(w.position).toBe(profile.work[i]?.position[lang]);
    });
  });

  it('cada logro (suelto o agrupado) es literal del perfil y pertenece a su empleo', () => {
    cv.work.forEach((w, i) => {
      const source = profile.work[i]?.highlights.map((h) => h.text[lang]) ?? [];
      const all = [...w.highlights, ...w.groups.flatMap((g) => g.highlights)];
      expect(all.length).toBeGreaterThan(0);
      expect(new Set(all).size).toBe(all.length);
      for (const h of all) expect(source).toContain(h);
    });
  });

  it('los proyectos son literales del perfil y sin enlaces inventados', () => {
    for (const p of cv.projects) {
      const src = profile.projects.find((x) => x.id === p.id);
      expect(src).toBeDefined();
      expect(p.name).toBe(src?.name[lang]);
      expect(p.description).toBe(src?.description[lang]);
      expect(p.url).toBe(src?.url);
      if (src?.confidential) expect(p.url).toBeUndefined();
    }
  });

  it('nunca presenta formación o proyectos personales como experiencia laboral', () => {
    for (const w of cv.work)
      for (const t of w.technologies) expect(nonProfessional).not.toContain(t);
    for (const s of cv.skills)
      for (const t of [...s.featured, ...s.keywords]) expect(nonProfessional).not.toContain(t);
    for (const k of cv.knowledge) expect(nonProfessional).toContain(k.name);
    expect(cv.knowledge.map((k) => k.name)).toEqual(
      v.knowledge.map((id) => profile.skills.find((s) => s.id === id)?.name),
    );
  });

  it('competencias, educación e idiomas salen del perfil', () => {
    const competencies = profile.competencies.map((c) => c.text[lang]);
    for (const c of cv.competencies) expect(competencies).toContain(c);
    expect(cv.education).toHaveLength(profile.education.length);
    expect(cv.languages).toHaveLength(profile.languages.length);
  });
});

describe('paridad ES/EN', () => {
  it.each(variants.map((v) => [v.id] as const))('%s: mismas cantidades en cada sección', (id) => {
    const [es, en] = LANGS.map((l) => loadCV(l, id));
    const counts = (cv: typeof es) =>
      cv && {
        work: cv.work.map((w) => [w.highlights.length, w.groups.length, w.technologies.length]),
        projects: cv.projects.map((p) => [p.id, p.highlights.length]),
        skills: cv.skills.map((s) => [s.featured.length, s.keywords.length]),
        competencies: cv.competencies.length,
        knowledge: cv.knowledge.length,
        certificates: cv.certificates.length,
      };
    expect(counts(es)).toEqual(counts(en));
  });
});

describe('casos de estudio', () => {
  it('cada proyecto con caseStudy tiene MDX en ambos idiomas y viceversa', () => {
    const files = Object.fromEntries(
      LANGS.map((l) => [
        l,
        readdirSync(`src/content/projects/${l}`).filter((f) => f.endsWith('.mdx')),
      ]),
    );
    expect(checkCaseStudies(profile, files)).toEqual([]);
  });
});
