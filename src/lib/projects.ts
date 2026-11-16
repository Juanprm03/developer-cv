/**
 * Modelo de vista de los proyectos: une los HECHOS del perfil maestro (nombre, empresa,
 * rol, estado, stack, enlaces, métricas, confidencialidad) con la NARRATIVA del caso de
 * estudio MDX (tagline, orden, destacado, cuerpo). El slug del MDX es el id del proyecto.
 */
import { type CollectionEntry, getCollection } from 'astro:content';
import { loadProfile } from './cv.ts';
import { ui } from './i18n.ts';
import { categoriesFor, type FilterCategory } from './project-filters.ts';
import type { Lang } from './schema.ts';

export type ProjectEntry = CollectionEntry<'projects'>;

export interface ProjectView {
  slug: string;
  entry: ProjectEntry;
  title: string;
  tagline: string;
  description: string;
  context: 'professional' | 'personal';
  /** Empresa (profesional) o "Proyecto personal". */
  organization: string;
  role: string;
  /** Solo si está confirmado en el perfil. */
  status?: 'production' | 'development' | 'stopped' | undefined;
  confidential: boolean;
  url?: string | undefined;
  technologies: string[];
  /** Ids de skills (para filtros) y categorías de filtro derivadas. */
  techIds: string[];
  categories: FilterCategory[];
  metrics: { value: string; label: string }[];
  featured: boolean;
  order: number;
}

/** `es/payments-platform` → `payments-platform`. */
export const projectSlug = (e: ProjectEntry) => e.id.split('/').slice(1).join('/');

/** Proyectos con caso de estudio de un idioma, ordenados. */
export async function loadProjects(lang: Lang): Promise<ProjectView[]> {
  const profile = loadProfile();
  const entries = await getCollection('projects', (e) => e.id.startsWith(`${lang}/`));
  const skill = (id: string) => profile.skills.find((s) => s.id === id)?.name ?? id;
  return entries
    .map((entry): ProjectView => {
      const slug = projectSlug(entry);
      const p = profile.projects.find((x) => x.id === slug);
      if (!p) throw new Error(`El caso ${entry.id} no corresponde a ningún proyecto del perfil`);
      const work = p.work ? profile.work.find((w) => w.id === p.work) : undefined;
      return {
        slug,
        entry,
        title: p.name[lang],
        tagline: entry.data.tagline,
        description: p.description[lang],
        context: p.context,
        organization: work?.company ?? ui[lang].personal,
        role: p.role?.[lang] ?? work?.position[lang] ?? ui[lang].personal,
        status: p.status,
        confidential: p.confidential,
        url: p.url,
        technologies: p.technologies.map(skill),
        techIds: [...p.technologies],
        categories: categoriesFor(
          { techIds: p.technologies, tags: p.tags },
          (id) => profile.skills.find((s) => s.id === id)?.category,
        ),
        metrics: p.metrics.map((m) => ({ value: m.value[lang], label: m.label[lang] })),
        featured: entry.data.featured,
        order: entry.data.order,
      };
    })
    .sort((a, b) => a.order - b.order);
}
