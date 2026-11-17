/**
 * Resolutor PURO: (perfil maestro, variante, etiquetas, idioma) → CV (`cvSchema`).
 *
 * Dos fases:
 * 1. `selectVariant`: decide QUÉ hechos entran y en qué orden. Es independiente del
 *    idioma, así que la versión ES y la EN de una variante contienen exactamente los
 *    mismos hechos (paridad por construcción).
 * 2. `renderCV`: proyecta esa selección a textos de un idioma, sin crear contenido.
 *
 * Sin E/S ni dependencias de Astro: lo usan la web, los scripts de Typst y los tests.
 */
import { routes } from './i18n.ts';
import type { Profile, ProfileHighlight } from './profile-schema.ts';
import { type CV, cvSchema, type Lang } from './schema.ts';
import type { Variant } from './variant-schema.ts';

export type Labels = CV['meta']['labels'];
export type LabelsByLang = Record<Lang, Labels>;

export interface Selection {
  variant: string;
  work: {
    id: string;
    highlights: string[];
    groups: { title: Record<Lang, string>; highlights: string[] }[];
    technologies: string[];
  }[];
  competencies: string[];
  skills: { category: string; featured: string[]; keywords: string[] }[];
  projects: { id: string; highlights: string[] }[];
  knowledge: string[];
}

/** Errores de referencia de una variante contra el perfil (vacío = válida). */
export function validateVariant(profile: Profile, variant: Variant): string[] {
  const errors: string[] = [];
  const at = (msg: string) => errors.push(`variants/${variant.id}: ${msg}`);
  const skills = new Map(profile.skills.map((s) => [s.id, s]));
  const highlights = new Set([
    ...profile.work.flatMap((w) => w.highlights.map((h) => h.id)),
    ...profile.projects.flatMap((p) => p.highlights.map((h) => h.id)),
  ]);
  const competencies = new Set(profile.competencies.map((c) => c.id));
  const projects = new Set(profile.projects.map((p) => p.id));
  const categories = new Set(profile.skillCategories.map((c) => c.id));
  const tags = new Set([
    ...profile.work.flatMap((w) => w.highlights.flatMap((h) => h.tags)),
    ...profile.projects.flatMap((p) => [...p.tags, ...p.highlights.flatMap((h) => h.tags)]),
    ...profile.competencies.flatMap((c) => c.tags),
    ...profile.skills.flatMap((s) => s.tags),
  ]);

  for (const t of variant.tags) if (!tags.has(t)) at(`etiqueta "${t}" no usada en el perfil`);
  for (const id of [...variant.highlights.pin, ...variant.highlights.exclude])
    if (!highlights.has(id)) at(`logro desconocido "${id}"`);
  for (const id of variant.competencies)
    if (!competencies.has(id)) at(`competencia desconocida "${id}"`);
  for (const id of variant.projects) if (!projects.has(id)) at(`proyecto desconocido "${id}"`);
  for (const id of variant.skills.categories)
    if (!categories.has(id)) at(`categoría desconocida "${id}"`);
  for (const id of [...variant.skills.featured, ...variant.skills.exclude]) {
    const s = skills.get(id);
    if (!s) at(`skill desconocida "${id}"`);
    else if (variant.skills.featured.includes(id) && s.context !== 'professional')
      at(`"${id}" (${s.context}) no puede destacarse como habilidad profesional`);
  }
  for (const id of variant.knowledge) {
    const s = skills.get(id);
    if (!s) at(`skill desconocida "${id}" en knowledge`);
    else if (s.context === 'professional')
      at(`"${id}" es professional: va en skills, no en knowledge`);
  }
  for (const [workId, groups] of Object.entries(variant.groups)) {
    const job = profile.work.find((w) => w.id === workId);
    if (!job) {
      at(`groups: empleo desconocido "${workId}"`);
      continue;
    }
    const own = new Set(job.highlights.map((h) => h.id));
    const used = groups.flatMap((g) => g.highlights);
    for (const id of used)
      if (!own.has(id)) at(`groups.${workId}: "${id}" no es un logro de ese empleo`);
    if (new Set(used).size !== used.length) at(`groups.${workId}: logros repetidos entre grupos`);
  }
  for (const id of variant.pdf?.projects ?? [])
    if (!projects.has(id)) at(`pdf.projects: proyecto desconocido "${id}"`);
  for (const p of profile.projects) {
    const job = p.work ? profile.work.find((w) => w.id === p.work) : undefined;
    const allowed = new Set([...p.technologies, ...(job?.technologies ?? [])]);
    for (const id of p.cv?.technologies ?? [])
      if (!allowed.has(id))
        at(`proyecto ${p.id}: tecnología "${id}" ajena al proyecto o su empleo`);
  }
  for (const list of ['competencies', 'projects', 'knowledge'] as const) {
    const ids = variant[list];
    if (new Set(ids).size !== ids.length) at(`${list} contiene ids repetidos`);
  }
  return errors;
}

/** Puntuación de un logro: cuántas etiquetas de la variante comparte, ponderadas por orden. */
function score(h: ProfileHighlight, tags: string[]): number {
  return tags.reduce((acc, t, i) => acc + (h.tags.includes(t) ? tags.length - i : 0), 0);
}

/** Fase 1: selección independiente del idioma. */
export function selectVariant(profile: Profile, variant: Variant): Selection {
  const pin = new Set(variant.highlights.pin);
  const exclude = new Set(variant.highlights.exclude);
  const { tags } = variant;

  const pick = (list: ProfileHighlight[], max: number, keepOne: boolean): string[] => {
    const candidates = list.filter((h) => !exclude.has(h.id));
    const pinned = candidates.filter((h) => pin.has(h.id));
    const ranked = candidates
      .filter((h) => !pin.has(h.id) && (tags.length === 0 || score(h, tags) > 0))
      .map((h, i) => ({ h, i, s: score(h, tags) }))
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((x) => x.h);
    const chosen = [...pinned, ...ranked].slice(0, max).map((h) => h.id);
    // Cada empleo conserva al menos un logro: omitir un empleo dejaría huecos en la cronología.
    if (keepOne && chosen.length === 0) {
      const first = candidates[0] ?? list[0];
      if (first) chosen.push(first.id);
    }
    return chosen;
  };

  const work = profile.work.map((w) => {
    const groups = (variant.groups[w.id] ?? []).map((g) => ({
      title: g.title,
      highlights: g.highlights.filter((id) => !exclude.has(id)),
    }));
    return {
      id: w.id,
      // Con grupos, los logros se presentan agrupados (sin lista plana duplicada).
      highlights: groups.length ? [] : pick(w.highlights, variant.highlights.maxPerJob, true),
      groups: groups.filter((g) => g.highlights.length > 0),
      technologies: variant.workTechnologies ? [...w.technologies] : [],
    };
  });

  const featured = variant.skills.featured;
  const excluded = new Set(variant.skills.exclude);
  const order = [
    ...variant.skills.categories,
    ...profile.skillCategories
      .map((c) => c.id)
      .filter((c) => !variant.skills.categories.includes(c)),
  ];
  const skills = order
    .map((category) => {
      const inCategory = profile.skills.filter(
        (s) => s.category === category && s.context === 'professional' && !excluded.has(s.id),
      );
      const ids = new Set(inCategory.map((s) => s.id));
      return {
        category,
        featured: featured.filter((id) => ids.has(id)),
        keywords: inCategory.map((s) => s.id).filter((id) => !featured.includes(id)),
      };
    })
    .filter((c) => c.featured.length + c.keywords.length > 0);

  const projects = variant.projects.map((id) => {
    const p = profile.projects.find((x) => x.id === id);
    return { id, highlights: p ? pick(p.highlights, p.highlights.length, false) : [] };
  });

  return {
    variant: variant.id,
    work,
    competencies: [...variant.competencies],
    skills,
    projects,
    knowledge: [...variant.knowledge],
  };
}

const must = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`Referencia rota: ${what}`);
  return value;
};

/** Une la URL raíz del sitio con una ruta relativa. */
export const siteUrl = (site: string, path: string) =>
  new URL(path.replace(/^\//, ''), site.endsWith('/') ? site : `${site}/`).href;

/** Fase 2: proyecta la selección a un idioma. No crea hechos nuevos. */
export function renderCV(
  profile: Profile,
  selection: Selection,
  variant: Variant,
  labels: LabelsByLang,
  lang: Lang,
  target: Target = 'web',
): CV {
  const skill = (id: string) =>
    must(
      profile.skills.find((s) => s.id === id),
      `skill ${id}`,
    );
  const { person, site } = profile;
  const featured = target === 'pdf' && variant.pdf?.featuredProjects === true;

  const work = selection.work.map((sel) => {
    const w = must(
      profile.work.find((x) => x.id === sel.id),
      `work ${sel.id}`,
    );
    const hl = (id: string) =>
      must(
        w.highlights.find((h) => h.id === id),
        `highlight ${id}`,
      ).text[lang];
    return {
      name: w.company,
      position: w.position[lang],
      ...(w.location && { location: w.location[lang] }),
      ...(w.url && { url: w.url }),
      startDate: w.startDate,
      ...(w.endDate && { endDate: w.endDate }),
      ...(w.summary && { summary: w.summary[lang] }),
      highlights: sel.highlights.map(hl),
      groups: sel.groups.map((g) => ({ name: g.title[lang], highlights: g.highlights.map(hl) })),
      technologies: sel.technologies.map((id) => skill(id).name),
    };
  });

  const projects = selection.projects.map((sel) => {
    const p = must(
      profile.projects.find((x) => x.id === sel.id),
      `project ${sel.id}`,
    );
    // «Proyectos destacados» del PDF: presentación `cv` del perfil (si existe).
    const view = featured ? p.cv : undefined;
    return {
      id: p.id,
      name: (view?.name ?? p.name)[lang],
      description: (view?.description ?? p.description)[lang],
      ...(p.url && { url: p.url }),
      highlights: view?.highlights.length
        ? view.highlights.map((h) => h.text[lang])
        : sel.highlights.map(
            (id) =>
              must(
                p.highlights.find((h) => h.id === id),
                `highlight ${id}`,
              ).text[lang],
          ),
      technologies: (view?.technologies ?? p.technologies).map((id) => skill(id).name),
      context: p.context,
      ...(p.status && { status: p.status }),
      ...(p.caseStudy && { caseStudy: p.id }),
    };
  });

  const cv = {
    meta: {
      lang,
      title: variant.title[lang],
      description: variant.description[lang],
      lastModified: profile.updated,
      labels: labels[lang],
      variant: variant.id,
      referencesNote: variant.referencesNote,
      featuredProjects: featured,
    },
    basics: {
      name: person.name,
      label: variant.label[lang],
      email: person.email,
      ...(person.phone && { phone: person.phone }),
      url: siteUrl(person.site, routes.home[lang]),
      summary: variant.summary[lang],
      ...(person.availability && { availability: person.availability[lang] }),
      location: {
        city: person.location.city,
        countryCode: person.location.countryCode,
        country: person.location.country[lang],
        ...(person.location.remote && { remote: person.location.remote[lang] }),
      },
      profiles: person.profiles.map((p) => ({ ...p })),
    },
    home: {
      kicker: site.kicker[lang],
      headline: site.headline[lang],
      intro: site.intro[lang],
      experience: site.experience[lang],
      specializations: site.specializations.map((s) => ({
        title: s.title[lang],
        skills: s.skills.map((id) => skill(id).name),
      })),
      approach: { title: site.approach.title[lang], intro: site.approach.intro[lang] },
      figures: site.figures.map((f) => ({
        value: f.value[lang],
        label: f.label[lang],
        note: f.note[lang],
      })),
    },
    principles: site.principles.map((p) => ({
      title: p.title[lang],
      description: p.description[lang],
      ...(p.example && { example: p.example[lang] }),
    })),
    competencies: selection.competencies.map(
      (id) =>
        must(
          profile.competencies.find((c) => c.id === id),
          `competency ${id}`,
        ).text[lang],
    ),
    work,
    projects,
    skills: selection.skills.map((c) => ({
      name: must(
        profile.skillCategories.find((x) => x.id === c.category),
        `category ${c.category}`,
      ).name[lang],
      featured: c.featured.map((id) => skill(id).name),
      keywords: c.keywords.map((id) => skill(id).name),
    })),
    education: profile.education.map((e) => ({
      institution: e.institution,
      area: e.area[lang],
      studyType: e.studyType[lang],
      ...(e.startDate && { startDate: e.startDate }),
      endDate: e.endDate,
      ...(e.url && { url: e.url }),
    })),
    certificates: profile.certificates.map((c) => ({
      name: c.name[lang],
      ...(c.issuer && { issuer: c.issuer }),
      ...(c.date && { date: c.date }),
      ...(c.url && { url: c.url }),
    })),
    languages: profile.languages.map((l) => ({
      language: l.language[lang],
      fluency: l.fluency[lang],
    })),
    knowledge: selection.knowledge.map((id) => {
      const s = skill(id);
      if (s.context === 'professional') throw new Error(`${id} no es conocimiento personal`);
      return { name: s.name, context: s.context };
    }),
  };

  return cvSchema.parse(cv);
}

/** Destino del CV: la web o el PDF (que aplica los ajustes `variant.pdf`). */
export type Target = 'web' | 'pdf';

/** Variante efectiva para un destino: en el PDF, `pdf.projects` y `pdf.groups` sustituyen a los de la web. */
export function variantFor(variant: Variant, target: Target): Variant {
  const pdf = variant.pdf;
  if (target !== 'pdf' || !pdf) return variant;
  return {
    ...variant,
    projects: pdf.projects ?? variant.projects,
    groups: pdf.groups ?? variant.groups,
  };
}

/** Atajo: valida la variante y resuelve el CV de un idioma para un destino (web por defecto). */
export function resolveCV(input: {
  profile: Profile;
  variant: Variant;
  labels: LabelsByLang;
  lang: Lang;
  target?: Target;
}): CV {
  const variant = variantFor(input.variant, input.target ?? 'web');
  const errors = validateVariant(input.profile, variant);
  if (errors.length) throw new Error(errors.join('\n'));
  return renderCV(
    input.profile,
    selectVariant(input.profile, variant),
    variant,
    input.labels,
    input.lang,
    input.target,
  );
}
