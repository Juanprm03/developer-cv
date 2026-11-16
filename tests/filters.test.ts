/** Filtros del catálogo (dos niveles) y cifras publicadas. */
import { describe, expect, it } from 'vitest';
import { loadCV, loadProfile } from '../src/lib/cv.ts';
import { categoriesFor, matchesFilters, techOptions } from '../src/lib/project-filters.ts';
import { LANGS } from '../src/lib/schema.ts';

const profile = loadProfile();
const cat = (id: string) => profile.skills.find((s) => s.id === id)?.category;
const projects = profile.projects
  .filter((p) => p.caseStudy)
  .map((p) => ({
    id: p.id,
    techIds: p.technologies,
    categories: categoriesFor({ techIds: p.technologies, tags: p.tags }, cat) as string[],
    technologies: p.technologies.map((id) => ({
      id,
      name: profile.skills.find((s) => s.id === id)?.name ?? id,
    })),
  }));
const byId = (id: string) => projects.find((p) => p.id === id);

describe('filtros de proyectos', () => {
  it('asigna categorías según las tecnologías y etiquetas reales', () => {
    expect(byId('payments-platform')?.categories).toEqual(['backend', 'integrations']);
    expect(byId('ticketing-ecosystem')?.categories).toContain('frontend');
    expect(byId('conversational-platform')?.categories).toEqual(
      expect.arrayContaining(['backend', 'ai', 'integrations']),
    );
  });

  it('cada categoría y cada tecnología del selector tienen al menos un proyecto', () => {
    for (const c of ['backend', 'frontend', 'ai', 'cloud', 'integrations'])
      expect(projects.some((p) => p.categories.includes(c))).toBe(true);
    const options = techOptions(projects);
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
    for (const o of options) {
      expect(o.count).toBeGreaterThan(0);
      expect(projects.filter((p) => p.techIds.includes(o.id))).toHaveLength(o.count);
    }
  });

  it('combina categoría y tecnología', () => {
    const shown = (c: string, t: string) =>
      projects.filter((p) => matchesFilters(p, c, t)).map((p) => p.id);
    expect(shown('all', 'all')).toHaveLength(projects.length);
    expect(shown('backend', 'django')).toEqual(['modular-erp']);
    expect(shown('frontend', 'django')).toEqual([]);
    expect(shown('integrations', 'nestjs')).toEqual(
      expect.arrayContaining(['payments-platform', 'notification-service']),
    );
  });
});

describe('experiencia en cifras', () => {
  it('solo publica los indicadores aprobados y con definición', () => {
    expect(profile.site.figures.map((f) => f.id)).toEqual([
      'combined-experience',
      'contributed-apps',
      'independent-services',
    ]);
    for (const f of profile.site.figures)
      for (const l of LANGS) expect(f.note[l].length).toBeGreaterThan(20);
  });

  it.each(LANGS)('%s: no publica métricas sin evidencia reproducible', (lang) => {
    const text = JSON.stringify(loadCV(lang));
    expect(text).not.toMatch(/53\s*(s\b|seg|segundos|seconds)/i);
    expect(text).not.toMatch(/commits/i);
  });
});
