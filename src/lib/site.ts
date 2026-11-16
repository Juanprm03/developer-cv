/**
 * Vistas del contenido exclusivo de la web (no aparece en los PDF), derivadas del perfil
 * maestro: áreas de experiencia con su evidencia, stack por nivel y tipos de producto.
 */
import { loadProfile } from './cv.ts';
import type { SkillContext } from './profile-schema.ts';
import type { Lang } from './schema.ts';

export interface CapabilityView {
  id: string;
  title: string;
  summary: string;
  skills: { name: string; context: SkillContext }[];
  evidence: { label: string; slug?: string | undefined }[];
}

export function capabilities(lang: Lang): CapabilityView[] {
  const p = loadProfile();
  const skill = (id: string) => p.skills.find((s) => s.id === id);
  return p.capabilities.map((c) => ({
    id: c.id,
    title: c.title[lang],
    summary: c.summary[lang],
    skills: c.skills.flatMap((id) => {
      const s = skill(id);
      return s ? [{ name: s.name, context: s.context }] : [];
    }),
    evidence: [
      // Un empleo solo se cita si ninguno de los proyectos del área le pertenece (evita repetir
      // "C-Pocket" en cada tarjeta: sus proyectos ya lo indican).
      ...c.work.flatMap((id) => {
        const w = p.work.find((x) => x.id === id);
        const covered = c.projects.some((pid) => p.projects.find((x) => x.id === pid)?.work === id);
        return w && !covered ? [{ label: w.company }] : [];
      }),
      ...c.projects.flatMap((id) => {
        const pr = p.projects.find((x) => x.id === id);
        return pr
          ? [
              {
                label: pr.name[lang].split(' — ')[0] ?? pr.name[lang],
                slug: pr.caseStudy ? pr.id : undefined,
              },
            ]
          : [];
      }),
    ],
  }));
}

export interface TechTier {
  context: SkillContext;
  groups: { category: string; skills: { name: string; where: string[] }[] }[];
}

/** Stack separado por nivel: experiencia profesional, proyectos personales y formación. */
export function techTiers(lang: Lang): TechTier[] {
  const p = loadProfile();
  const order: SkillContext[] = ['professional', 'personal', 'learning'];
  const short = (name: string) => name.split(' — ')[0] ?? name;
  return order.map((context) => ({
    context,
    groups: p.skillCategories
      .map((cat) => ({
        category: cat.name[lang],
        skills: p.skills
          .filter((s) => s.context === context && s.category === cat.id)
          .map((s) => ({
            name: s.name,
            where:
              context === 'personal'
                ? p.projects
                    .filter((pr) => pr.context === 'personal' && pr.technologies.includes(s.id))
                    .map((pr) => short(pr.name[lang]))
                : [],
          })),
      }))
      .filter((g) => g.skills.length > 0),
  }));
}

export const domains = (lang: Lang) => loadProfile().site.domains.map((d) => d.text[lang]);
