/**
 * Perfil maestro: ÚNICA fuente de hechos profesionales (data/profile.yaml).
 *
 * - Cada hecho tiene un `id` estable que las variantes referencian.
 * - Los textos van en los dos idiomas en el mismo nodo (`{ es, en }`): la paridad
 *   ES/EN la garantiza el esquema y las fechas, empresas y cifras no se duplican.
 * - Las habilidades declaran su contexto (`professional`, `personal`, `learning`)
 *   para que nunca se presenten proyectos personales o formación como experiencia laboral.
 */
import { z } from 'zod';
import { type LANGS, PROJECT_CONTEXTS, PROJECT_STATUSES, partialDate, richText } from './schema.ts';

/** `kebab-case`, estable: se usa en URLs, PDF y referencias entre archivos. */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Usa un id en kebab-case (a-z, 0-9 y guiones)');

/** Texto obligatorio en todos los idiomas del sitio. */
export const localized = <T extends z.ZodType>(schema: T) =>
  z.strictObject({ es: schema, en: schema });

const text = localized(z.string().min(1));
const rich = localized(richText);

/**
 * - professional: usada en un empleo (evidencia en código, historial o CV aprobados).
 * - personal: usada en proyectos propios, no en un empleo.
 * - learning: en formación (cursos, estudio); sin uso demostrado en proyectos.
 */
export const SKILL_CONTEXTS = ['professional', 'personal', 'learning'] as const;
export type SkillContext = (typeof SKILL_CONTEXTS)[number];

const highlightSchema = z.strictObject({
  id: idSchema,
  text: rich,
  /** Etiquetas temáticas que usan las variantes para seleccionar (p. ej. `ai`, `python`). */
  tags: z.array(idSchema).min(1),
  /** Proyecto del perfil al que se refiere el logro (opcional). */
  project: idSchema.optional(),
});

const workSchema = z.strictObject({
  id: idSchema,
  company: z.string().min(1),
  position: text,
  /** Ciudad o modalidad. Se omite si no está confirmada. */
  location: text.optional(),
  url: z.url().optional(),
  startDate: partialDate,
  endDate: partialDate.optional(),
  summary: rich.optional(),
  /** Ids del catálogo `skills`; deben tener contexto `professional`. */
  technologies: z.array(idSchema).default([]),
  highlights: z.array(highlightSchema).min(1),
});

const projectSchema = z.strictObject({
  id: idSchema,
  name: text,
  description: rich,
  context: z.enum(PROJECT_CONTEXTS),
  /** Estado SOLO si está confirmado; si se omite, no se muestra. */
  status: z.enum(PROJECT_STATUSES).optional(),
  /** Empleo en el que se desarrolló (solo proyectos profesionales). */
  work: idSchema.optional(),
  /** URL pública. Nunca inventar enlaces a repositorios o productos privados. */
  url: z.url().optional(),
  /** Confidencial: no se enlaza código ni se publican datos internos. */
  confidential: z.boolean().default(false),
  /** Existe un caso de estudio MDX con slug = id en ambos idiomas. */
  caseStudy: z.boolean().default(false),
  /** Rol en el proyecto; si se omite, se usa el cargo del empleo o "Proyecto personal". */
  role: text.optional(),
  technologies: z.array(idSchema).min(1),
  highlights: z.array(highlightSchema).default([]),
  /**
   * Presentación en «Proyectos destacados» del CV en PDF (variantes con `pdf.featuredProjects`).
   * Solo hechos respaldados por el caso de estudio; las tecnologías deben estar en las del
   * proyecto o, si es profesional, en las de su empleo.
   */
  cv: z
    .strictObject({
      name: text.optional(),
      description: rich.optional(),
      technologies: z.array(idSchema).optional(),
      highlights: z.array(highlightSchema).default([]),
    })
    .optional(),
  /** Cifras verificables del proyecto (máx. 4). Nunca estimaciones sin fuente. */
  metrics: z
    .array(z.strictObject({ value: text, label: text }))
    .max(4)
    .default([]),
  tags: z.array(idSchema).min(1),
});

export const profileSchema = z
  .strictObject({
    /** Última revisión del contenido (YYYY-MM). */
    updated: partialDate,

    person: z.strictObject({
      name: z.string().min(1),
      email: z.email(),
      phone: z.string().optional(),
      /** URL raíz del sitio publicado (versión ES); la EN se deriva de las rutas. */
      site: z.url(),
      location: z.strictObject({
        city: z.string().min(1),
        country: text,
        countryCode: z.string().length(2),
        remote: text.optional(),
      }),
      availability: text.optional(),
      profiles: z.array(
        z.strictObject({ network: z.string(), username: z.string(), url: z.url() }),
      ),
    }),

    /** Contenido exclusivo de la web (no aparece en los PDF). */
    site: z.strictObject({
      kicker: text,
      headline: text,
      intro: text,
      /** Experiencia combinada (empleo + proyectos personales), redactada sin inflarla. */
      experience: text,
      /** Áreas de especialización del hero (sustituyen a las cifras sin respaldo suficiente). */
      specializations: z
        .array(
          z.strictObject({ id: idSchema, title: text, skills: z.array(idSchema).min(1).max(4) }),
        )
        .min(3)
        .max(6),
      /** Sección "Cómo trabajo": título, introducción y principios con ejemplos reales. */
      approach: z.strictObject({ title: text, intro: text }),
      principles: z
        .array(
          z.strictObject({
            id: idSchema,
            title: text,
            description: text,
            /** Ejemplo concreto de la experiencia que respalda el principio. */
            example: text.optional(),
          }),
        )
        .min(4)
        .max(6),
      /** Experiencia en cifras: indicadores con definición explícita y evidencia (máx. 4). */
      figures: z
        .array(z.strictObject({ id: idSchema, value: text, label: text, note: text }))
        .max(4)
        .default([]),
      /** Tipos de producto en los que hay experiencia demostrable (para reclutadores). */
      domains: z.array(z.strictObject({ id: idSchema, text })).max(8),
    }),

    /**
     * Áreas de experiencia: relacionan habilidades con empleos y proyectos concretos
     * (evidencia), en lugar de listas de tecnologías sin contexto.
     */
    capabilities: z
      .array(
        z.strictObject({
          id: idSchema,
          title: text,
          summary: text,
          skills: z.array(idSchema).min(1),
          projects: z.array(idSchema).default([]),
          work: z.array(idSchema).default([]),
        }),
      )
      .default([]),

    skillCategories: z.array(z.strictObject({ id: idSchema, name: text })).min(1),

    skills: z
      .array(
        z.strictObject({
          id: idSchema,
          name: z.string().min(1),
          category: idSchema,
          context: z.enum(SKILL_CONTEXTS),
          tags: z.array(idSchema).default([]),
        }),
      )
      .min(1),

    competencies: z.array(z.strictObject({ id: idSchema, text, tags: z.array(idSchema) })),

    work: z.array(workSchema).min(1),
    projects: z.array(projectSchema).default([]),

    education: z.array(
      z.strictObject({
        id: idSchema,
        institution: z.string(),
        studyType: text,
        area: text,
        startDate: partialDate.optional(),
        endDate: partialDate,
        url: z.url().optional(),
      }),
    ),

    certificates: z
      .array(
        z.strictObject({
          id: idSchema,
          name: text,
          issuer: z.string().optional(),
          date: partialDate.optional(),
          url: z.url().optional(),
          /** Habilidades del catálogo que acredita (cualquier contexto). */
          skills: z.array(idSchema).default([]),
        }),
      )
      .default([]),

    languages: z.array(z.strictObject({ id: idSchema, language: text, fluency: text })),
  })
  .superRefine((p, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    // Ids únicos en todo el perfil (un logro y un proyecto no pueden compartir id).
    const seen = new Map<string, string>();
    const claim = (id: string, where: string, path: (string | number)[]) => {
      const prev = seen.get(id);
      if (prev) issue(path, `id duplicado "${id}" (ya usado en ${prev})`);
      else seen.set(id, where);
    };
    p.skills.forEach((s, i) => {
      claim(s.id, 'skills', ['skills', i, 'id']);
    });
    p.work.forEach((w, i) => {
      claim(w.id, 'work', ['work', i, 'id']);
      w.highlights.forEach((h, j) => {
        claim(h.id, `work.${w.id}`, ['work', i, 'highlights', j]);
      });
    });
    p.projects.forEach((pr, i) => {
      claim(pr.id, 'projects', ['projects', i, 'id']);
      pr.highlights.forEach((h, j) => {
        claim(h.id, `projects.${pr.id}`, ['projects', i, 'highlights', j]);
      });
    });

    const skills = new Map(p.skills.map((s) => [s.id, s]));
    const categories = new Set(p.skillCategories.map((c) => c.id));
    const projects = new Map(p.projects.map((pr) => [pr.id, pr]));
    const works = new Set(p.work.map((w) => w.id));

    p.skills.forEach((s, i) => {
      if (!categories.has(s.category))
        issue(['skills', i, 'category'], `categoría desconocida "${s.category}"`);
    });

    // Cronología: fechas coherentes y orden cronológico inverso por fecha de inicio.
    const months = (d: string) => {
      const [y, m = '1'] = d.split('-');
      return Number(y) * 12 + Number(m) - 1;
    };
    p.work.forEach((w, i) => {
      if (w.endDate && months(w.endDate) < months(w.startDate))
        issue(['work', i, 'endDate'], 'endDate es anterior a startDate');
      const prev = p.work[i - 1];
      if (prev && months(prev.startDate) < months(w.startDate))
        issue(['work', i], 'work debe estar en orden cronológico inverso (más reciente primero)');
      w.technologies.forEach((t, j) => {
        const s = skills.get(t);
        if (!s) issue(['work', i, 'technologies', j], `skill desconocida "${t}"`);
        else if (s.context !== 'professional')
          issue(
            ['work', i, 'technologies', j],
            `"${t}" tiene contexto ${s.context}: no puede figurar como experiencia laboral`,
          );
      });
      w.highlights.forEach((h, j) => {
        if (h.project && !projects.has(h.project))
          issue(['work', i, 'highlights', j, 'project'], `proyecto desconocido "${h.project}"`);
      });
    });
    p.education.forEach((e, i) => {
      if (e.startDate && months(e.endDate) < months(e.startDate))
        issue(['education', i, 'endDate'], 'endDate es anterior a startDate');
    });

    p.projects.forEach((pr, i) => {
      if (pr.work && !works.has(pr.work))
        issue(['projects', i, 'work'], `empleo desconocido "${pr.work}"`);
      if (pr.context === 'professional' && !pr.work)
        issue(['projects', i, 'work'], 'un proyecto profesional debe indicar su empleo');
      if (pr.context === 'personal' && pr.work)
        issue(['projects', i, 'work'], 'un proyecto personal no pertenece a un empleo');
      pr.technologies.forEach((t, j) => {
        const s = skills.get(t);
        if (!s) issue(['projects', i, 'technologies', j], `skill desconocida "${t}"`);
        else if (pr.context === 'professional' && s.context !== 'professional')
          issue(
            ['projects', i, 'technologies', j],
            `"${t}" (${s.context}) no puede figurar en un proyecto profesional`,
          );
      });
    });

    p.site.specializations.forEach((sp, i) => {
      sp.skills.forEach((t, j) => {
        const s = skills.get(t);
        if (!s) issue(['site', 'specializations', i, 'skills', j], `skill desconocida "${t}"`);
        else if (s.context !== 'professional')
          issue(
            ['site', 'specializations', i, 'skills', j],
            `"${t}" no es experiencia profesional`,
          );
      });
    });

    p.capabilities.forEach((c, i) => {
      c.skills.forEach((t, j) => {
        if (!skills.has(t)) issue(['capabilities', i, 'skills', j], `skill desconocida "${t}"`);
      });
      c.projects.forEach((t, j) => {
        if (!projects.has(t))
          issue(['capabilities', i, 'projects', j], `proyecto desconocido "${t}"`);
      });
      c.work.forEach((t, j) => {
        if (!works.has(t)) issue(['capabilities', i, 'work', j], `empleo desconocido "${t}"`);
      });
      if (c.projects.length + c.work.length === 0)
        issue(
          ['capabilities', i],
          'cada área debe citar al menos un empleo o proyecto como evidencia',
        );
    });

    // Una habilidad "personal" debe usarse en algún proyecto personal (si no, es "learning").
    const personalUse = new Set(
      p.projects.filter((pr) => pr.context === 'personal').flatMap((pr) => pr.technologies),
    );
    p.skills.forEach((s, i) => {
      if (s.context === 'personal' && !personalUse.has(s.id))
        issue(
          ['skills', i, 'context'],
          `"${s.id}" es personal pero ningún proyecto personal la usa: márcala como learning`,
        );
    });

    p.certificates.forEach((c, i) => {
      c.skills.forEach((t, j) => {
        if (!skills.has(t)) issue(['certificates', i, 'skills', j], `skill desconocida "${t}"`);
      });
    });
  });

export type Profile = z.infer<typeof profileSchema>;
export type ProfileWork = Profile['work'][number];
export type ProfileProject = Profile['projects'][number];
export type ProfileHighlight = ProfileWork['highlights'][number];
export type Localized<T> = Record<(typeof LANGS)[number], T>;
