/**
 * Contrato de SALIDA del CV: lo que consumen las páginas Astro y Typst.
 *
 * No se edita a mano: lo produce `resolveCV()` (src/lib/resolve.ts) a partir del
 * perfil maestro (data/profile.yaml) y de una variante (data/variants/*.yaml).
 * Basado en JSON Resume (https://jsonresume.org/schema) con extensiones propias.
 */
import { z } from 'zod';

/** Fecha parcial `YYYY-MM` o `YYYY`. */
export const partialDate = z
  .string()
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Usa el formato YYYY-MM o YYYY');

/** Texto con énfasis opcional `**negrita**`. Sin HTML. */
export const richText = z
  .string()
  .min(1)
  .refine((s) => !/[<>]/.test(s), 'No uses HTML; solo **negrita**')
  .refine((s) => (s.match(/\*\*/g)?.length ?? 0) % 2 === 0, 'Hay un ** sin cerrar');

const url = z.url();

export const PROJECT_CONTEXTS = ['professional', 'personal'] as const;
/** `stopped`: desarrollo detenido antes de terminarse (no se presenta como producto en producción). */
export const PROJECT_STATUSES = ['production', 'development', 'stopped'] as const;

export const cvSchema = z.strictObject({
  meta: z.strictObject({
    lang: z.enum(['es', 'en']),
    /** Título de la página y del PDF. */
    title: z.string(),
    /** Meta description (SEO), 120–160 caracteres. */
    description: z.string().min(80).max(170),
    /** Última revisión del contenido. */
    lastModified: partialDate,
    labels: z.strictObject({
      summary: z.string(),
      competencies: z.string(),
      work: z.string(),
      projects: z.string(),
      skills: z.string(),
      education: z.string(),
      certificates: z.string(),
      languages: z.string(),
      technologies: z.string(),
      present: z.string(),
      downloadPdf: z.string(),
      switchLang: z.string(),
      contact: z.string(),
      degreeIn: z.string(),
      /** Sección de conocimientos que NO son experiencia laboral. */
      knowledge: z.string(),
      knowledgePersonal: z.string(),
      knowledgeLearning: z.string(),
      knowledgeNote: z.string(),
      courses: z.string(),
      coursesKnowledge: z.string(),
      references: z.string(),
      referencesNote: z.string(),
      personalProject: z.string(),
      inDevelopment: z.string(),
      devStopped: z.string(),
      months: z.array(z.string()).length(12),
    }),
    /** Variante que generó este CV (p. ej. `general`, `backend-python`). */
    variant: z.string().optional(),
    /** Mostrar la nota de referencias disponibles a solicitud. */
    referencesNote: z.boolean().default(false),
  }),

  basics: z.strictObject({
    name: z.string(),
    label: z.string(),
    email: z.email(),
    phone: z.string().optional(),
    url: url.optional(),
    summary: richText,
    /** Modalidad y zona horaria, p. ej. "Remoto · UTC−5". */
    availability: z.string().optional(),
    location: z.strictObject({
      city: z.string(),
      countryCode: z.string().length(2),
      country: z.string(),
      remote: z.string().optional(),
    }),
    profiles: z.array(
      z.strictObject({
        network: z.string(),
        username: z.string(),
        url,
      }),
    ),
  }),

  /** Portada del sitio (home): propuesta de valor y especialización. No aparece en el PDF. */
  home: z.strictObject({
    /** Especialidad corta sobre el titular (p. ej. "Backend & Fullstack Developer"). */
    kicker: z.string(),
    headline: z.string(),
    intro: z.string(),
    experience: z.string(),
    specializations: z.array(z.strictObject({ title: z.string(), skills: z.array(z.string()) })),
    approach: z.strictObject({ title: z.string(), intro: z.string() }),
    figures: z
      .array(z.strictObject({ value: z.string(), label: z.string(), note: z.string() }))
      .default([]),
  }),

  /** Principios de trabajo (sección "Cómo trabajo" de la web; el PDF los resume en el perfil). */
  principles: z
    .array(
      z.strictObject({
        title: z.string(),
        description: z.string(),
        example: z.string().optional(),
      }),
    )
    .max(8)
    .default([]),

  /** Competencias clave (chips bajo el resumen). */
  competencies: z.array(z.string()).min(3).max(10),

  work: z
    .array(
      z
        .strictObject({
          name: z.string(),
          position: z.string(),
          location: z.string().optional(),
          url: url.optional(),
          startDate: partialDate,
          endDate: partialDate.optional(),
          summary: richText.optional(),
          highlights: z.array(richText).max(12).default([]),
          /** Logros agrupados por cliente (puestos de consultoría con varios clientes). */
          groups: z
            .array(
              z.strictObject({
                name: z.string(),
                note: z.string().optional(),
                highlights: z.array(richText).min(1).max(4),
              }),
            )
            .max(5)
            .default([]),
          technologies: z.array(z.string()).default([]),
        })
        .refine(
          (w) => w.highlights.length + w.groups.length > 0,
          'Cada puesto necesita highlights o groups',
        ),
    )
    .min(1),

  projects: z
    .array(
      z.strictObject({
        /** Identificador estable del perfil maestro (también slug del caso de estudio). */
        id: z.string().optional(),
        name: z.string(),
        description: richText,
        url: url.optional(),
        highlights: z.array(richText).default([]),
        technologies: z.array(z.string()).default([]),
        context: z.enum(PROJECT_CONTEXTS).default('professional'),
        status: z.enum(PROJECT_STATUSES).optional(),
        /** Slug del caso de estudio MDX, si existe. */
        caseStudy: z.string().optional(),
      }),
    )
    .default([]),

  skills: z.array(
    z.strictObject({
      name: z.string(),
      /** Las más fuertes, se resaltan. */
      featured: z.array(z.string()).default([]),
      keywords: z.array(z.string()).default([]),
    }),
  ),

  education: z.array(
    z.strictObject({
      institution: z.string(),
      area: z.string(),
      studyType: z.string(),
      startDate: partialDate.optional(),
      endDate: partialDate,
      url: url.optional(),
    }),
  ),

  certificates: z
    .array(
      z.strictObject({
        name: z.string(),
        issuer: z.string().optional(),
        date: partialDate.optional(),
        url: url.optional(),
      }),
    )
    .default([]),

  languages: z.array(
    z.strictObject({
      language: z.string(),
      fluency: z.string(),
    }),
  ),

  /**
   * Conocimientos de formación o proyectos personales. Se muestran en una sección
   * propia, rotulada como tal: nunca se mezclan con la experiencia laboral.
   */
  knowledge: z
    .array(
      z.strictObject({
        name: z.string(),
        context: z.enum(['personal', 'learning']),
      }),
    )
    .default([]),
});

export type CV = z.infer<typeof cvSchema>;
export type Lang = CV['meta']['lang'];
export const LANGS = ['es', 'en'] as const satisfies readonly Lang[];
