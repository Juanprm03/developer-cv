/**
 * «Proyectos destacados» del CV general en PDF: dos proyectos profesionales y uno personal, con
 * la experiencia de C-Pocket condensada para no repetirlos. La web conserva su selección.
 */
import { describe, expect, it } from 'vitest';
import { loadCV, loadLabels, loadProfile, loadVariants } from '../src/lib/cv.ts';
import { resolveCV, validateVariant, variantFor } from '../src/lib/resolve.ts';
import { LANGS } from '../src/lib/schema.ts';

const profile = loadProfile();
const general = loadVariants().find((v) => v.id === 'general');
if (!general) throw new Error('falta la variante general');
const pdf = (lang: (typeof LANGS)[number]) => loadCV(lang, undefined, 'pdf');
const web = (lang: (typeof LANGS)[number]) => loadCV(lang);
const highlight = (id: string, lang: (typeof LANGS)[number]) =>
  profile.work.flatMap((w) => w.highlights).find((h) => h.id === id)?.text[lang] ?? '';

describe('CV general en PDF: proyectos destacados', () => {
  it.each(LANGS)('selecciona los tres proyectos en orden (%s)', (lang) => {
    const cv = pdf(lang);
    expect(cv.meta.featuredProjects).toBe(true);
    expect(cv.projects.map((p) => p.id)).toEqual([
      'conversational-platform',
      'payments-platform',
      'modular-erp',
    ]);
    expect(cv.projects.map((p) => p.context)).toEqual(['professional', 'professional', 'personal']);
    expect(cv.projects.find((p) => p.id === 'modular-erp')).toMatchObject({
      name: 'Nexo ERP',
      status: 'development',
      url: 'https://github.com/Juanprm03/nexo-erp',
    });
  });

  it('usa las tecnologías acordadas para cada proyecto', () => {
    expect(pdf('es').projects.map((p) => p.technologies)).toEqual([
      ['Node.js', 'Express', 'WhatsApp Cloud API', 'OpenAI API', 'LangChain'],
      ['NestJS', 'TypeScript', 'REST APIs', 'Webhooks'],
      ['Python', 'Django', 'PostgreSQL', 'Docker'],
    ]);
  });

  it('ES y EN contienen los mismos proyectos, viñetas y tecnologías', () => {
    const [es, en] = LANGS.map(pdf);
    expect(es?.projects.map((p) => [p.id, p.highlights.length, p.technologies])).toEqual(
      en?.projects.map((p) => [p.id, p.highlights.length, p.technologies]),
    );
  });

  it.each(LANGS)('la experiencia no repite lo que detallan los proyectos (%s)', (lang) => {
    const job = pdf(lang).work[0];
    const bullets = job?.groups.flatMap((g) => g.highlights) ?? [];
    for (const moved of ['c-pocket-payments', 'c-pocket-whatsapp', 'c-pocket-conversational-ai'])
      expect(bullets).not.toContain(highlight(moved, lang));
    // El resto de contribuciones de C-Pocket se conserva (MCP sigue fuera: no verificado).
    for (const kept of [
      'c-pocket-ecosystem',
      'c-pocket-notifications',
      'c-pocket-sql',
      'c-pocket-ticketing',
      'c-pocket-proptech',
      'c-pocket-operations',
      'c-pocket-ai-backend',
      'c-pocket-aws',
      'c-pocket-quality',
    ])
      expect(bullets).toContain(highlight(kept, lang));
  });

  it('developer-cv sale solo del PDF: sigue en el perfil y en la web', () => {
    expect(profile.projects.some((p) => p.id === 'developer-cv')).toBe(true);
    for (const lang of LANGS) {
      expect(pdf(lang).projects.some((p) => p.id === 'developer-cv')).toBe(false);
      expect(web(lang).projects.map((p) => p.id)).toEqual(['modular-erp', 'developer-cv']);
    }
  });

  it('la web conserva la selección y los grupos aprobados', () => {
    const cv = web('es');
    expect(cv.meta.featuredProjects).toBe(false);
    expect(cv.work[0]?.groups.flatMap((g) => g.highlights)).toContain(
      highlight('c-pocket-payments', 'es'),
    );
    expect(cv.projects[0]?.name).toBe(
      profile.projects.find((p) => p.id === 'modular-erp')?.name.es,
    );
  });

  it('conserva teléfono, perfil, habilidades y nota de referencias', () => {
    for (const lang of LANGS) {
      const [a, b] = [pdf(lang), web(lang)];
      expect(a.basics).toEqual(b.basics);
      expect(a.skills).toEqual(b.skills);
      expect(a.education).toEqual(b.education);
      expect(a.languages).toEqual(b.languages);
      expect(a.meta.referencesNote).toBe(true);
    }
  });

  it('rechaza tecnologías de un proyecto que no son del proyecto ni de su empleo', () => {
    const tampered = structuredClone(profile);
    const p = tampered.projects.find((x) => x.id === 'payments-platform');
    if (p?.cv) p.cv.technologies = ['django'];
    expect(validateVariant(tampered, variantFor(general, 'pdf')).join()).toMatch(/django/);
  });

  it('sin target pdf, resolveCV ignora los ajustes del PDF', () => {
    const cv = resolveCV({ profile, variant: general, labels: loadLabels(), lang: 'en' });
    expect(cv.projects.map((p) => p.id)).toEqual(general.projects);
  });
});
