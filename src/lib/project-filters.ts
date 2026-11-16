/**
 * Filtros del catálogo de proyectos en dos niveles (lógica pura, comprobable):
 * 1. Categorías fijas: Backend, Frontend, IA y automatización, Cloud e Integraciones.
 *    Se asignan desde la categoría de cada tecnología en el perfil y las etiquetas del proyecto.
 * 2. Tecnología concreta: solo las que aparecen en algún proyecto (se generan de los datos).
 */
export const FILTER_CATEGORIES = ['backend', 'frontend', 'ai', 'cloud', 'integrations'] as const;
export type FilterCategory = (typeof FILTER_CATEGORIES)[number];

/** Tecnologías de infraestructura (Cloud) frente a las de integración con terceros. */
const CLOUD_SKILLS = new Set(['aws', 'docker', 'github-actions']);
const INTEGRATION_SKILLS = new Set(['whatsapp-cloud-api', 'slack-api', 'webhooks', 'rest-apis']);

export interface FilterableProject {
  /** Ids de skills del perfil. */
  techIds: string[];
  tags: string[];
}

export function categoriesFor(
  project: FilterableProject,
  skillCategory: (id: string) => string | undefined,
): FilterCategory[] {
  const cats = new Set<FilterCategory>();
  for (const id of project.techIds) {
    const c = skillCategory(id);
    if (c === 'backend' || c === 'data') cats.add('backend');
    if (c === 'frontend') cats.add('frontend');
    if (c === 'ai') cats.add('ai');
    if (CLOUD_SKILLS.has(id)) cats.add('cloud');
    if (INTEGRATION_SKILLS.has(id)) cats.add('integrations');
  }
  if (project.tags.some((t) => t === 'ai' || t === 'automation')) cats.add('ai');
  if (project.tags.some((t) => t === 'payments' || t === 'api')) cats.add('integrations');
  return FILTER_CATEGORIES.filter((c) => cats.has(c));
}

/** Opciones del selector de tecnología: presentes en al menos un proyecto, sin duplicados. */
export function techOptions(
  projects: { technologies: { id: string; name: string }[] }[],
): { id: string; name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const p of projects)
    for (const t of new Map(p.technologies.map((x) => [x.id, x])).values()) {
      const cur = counts.get(t.id);
      counts.set(t.id, { name: t.name, count: (cur?.count ?? 0) + 1 });
    }
  return [...counts]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** ¿El proyecto cumple la combinación de filtros? (`all` = sin filtro). */
export function matchesFilters(
  project: { categories: string[]; techIds: string[] },
  category: string,
  tech: string,
): boolean {
  return (
    (category === 'all' || project.categories.includes(category)) &&
    (tech === 'all' || project.techIds.includes(tech))
  );
}
