/**
 * Variante profesional (data/variants/<id>.yaml).
 *
 * Una variante SOLO selecciona, ordena y prioriza hechos del perfil maestro por
 * id o por etiqueta. Sus únicos textos libres son el titular (`label`), el título y
 * la descripción SEO y el resumen (`summary`); las pruebas comprueban que no
 * introduzcan tecnologías ni cifras ajenas al perfil.
 */
import { z } from 'zod';
import { idSchema, localized } from './profile-schema.ts';
import { richText } from './schema.ts';

export const variantSchema = z.strictObject({
  id: idSchema,
  /** Nombre corto para la lista de descargas (p. ej. "Backend Python"). */
  name: localized(z.string().min(1)),
  /** Orden en la lista de descargas (menor = primero). */
  order: z.number().int(),
  /** Variante por defecto: alimenta la web y los alias cv-es.pdf / cv-en.pdf. */
  default: z.boolean().default(false),
  /** Variante opcional (p. ej. Java en formación). */
  optional: z.boolean().default(false),
  /**
   * Pública: su PDF se publica en el sitio (solo la variante default). Las demás son
   * herramientas internas de postulación: se generan en private/cv/ y nunca llegan a dist/.
   */
  public: z.boolean().default(false),

  title: localized(z.string().min(1)),
  /** Meta description: 80–170 caracteres. */
  description: localized(z.string().min(80).max(170)),
  label: localized(z.string().min(1)),
  summary: localized(richText),

  /** Etiquetas que priorizan logros y competencias. Vacío = todo. */
  tags: z.array(idSchema).default([]),

  highlights: z
    .strictObject({
      /** Logros que se incluyen siempre (si su empleo/proyecto aparece). */
      pin: z.array(idSchema).default([]),
      exclude: z.array(idSchema).default([]),
      /** Máximo de logros por empleo (mínimo 1 se conserva siempre). */
      maxPerJob: z.number().int().min(1).max(12).default(4),
    })
    .default({ pin: [], exclude: [], maxPerJob: 4 }),

  /**
   * Agrupación de logros por empleo (id del empleo → grupos con título e ids de logros).
   * Solo cambia la presentación: los textos siguen siendo literales del perfil.
   */
  groups: z
    .record(
      idSchema,
      z.array(
        z.strictObject({
          title: localized(z.string().min(1)),
          highlights: z.array(idSchema).min(1),
        }),
      ),
    )
    .default({}),
  /** Añade al final del CV "Referencias profesionales disponibles a solicitud" (sin datos de terceros). */
  referencesNote: z.boolean().default(false),
  /** Mostrar la lista de tecnologías de cada empleo (el CV general la omite: ya está en habilidades). */
  workTechnologies: z.boolean().default(true),

  /** Competencias (ids del perfil) en el orden en que se muestran. */
  competencies: z.array(idSchema).min(3).max(10),

  skills: z
    .strictObject({
      /** Habilidades destacadas (deben ser `professional`). */
      featured: z.array(idSchema).default([]),
      /** Orden de categorías; las omitidas van después en el orden del perfil. */
      categories: z.array(idSchema).default([]),
      exclude: z.array(idSchema).default([]),
    })
    .default({ featured: [], categories: [], exclude: [] }),

  /** Proyectos (ids) que aparecen en el CV, en orden. */
  projects: z.array(idSchema).default([]),

  /**
   * Conocimientos de formación o proyectos personales (contexto `personal` o
   * `learning`) que se listan en su propia sección rotulada.
   */
  knowledge: z.array(idSchema).default([]),

  /** Límite de páginas del PDF (lo comprueba build-pdf). */
  maxPages: z.union([z.literal(1), z.literal(2)]).default(2),
});

export type Variant = z.infer<typeof variantSchema>;
