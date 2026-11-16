import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Casos de estudio: src/content/projects/<lang>/<slug>.mdx
 *
 * El slug es el id de un proyecto de data/profile.yaml con `caseStudy: true`. Los hechos
 * (nombre, empresa, rol, estado, stack, enlaces, métricas, confidencialidad) viven en el
 * perfil; el MDX solo aporta la narrativa y los diagramas. scripts/validate.ts comprueba
 * la correspondencia y la paridad ES/EN.
 */
const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.strictObject({
      /** Frase de una línea para la tarjeta y la meta description. */
      tagline: z.string().min(40).max(200),
      /** Orden en la landing (menor = primero). */
      order: z.number().int(),
      /** Destacado en la home y en grande en la landing (máx. 3). */
      featured: z.boolean().default(false),
      /** Captura de la web pública (src/content/projects/covers/). */
      cover: image().optional(),
    }),
});

export const collections = { projects };
