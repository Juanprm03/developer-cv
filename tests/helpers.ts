import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { type Profile, profileSchema } from '../src/lib/profile-schema.ts';
import type { LabelsByLang } from '../src/lib/resolve.ts';
import { type Variant, variantSchema } from '../src/lib/variant-schema.ts';

export const fixtureProfileRaw = (): Record<string, unknown> =>
  parse(readFileSync(new URL('./fixtures/profile.yaml', import.meta.url), 'utf8'));

export const fixtureProfile = (): Profile => profileSchema.parse(fixtureProfileRaw());

/** Variante de prueba con valores por defecto razonables. */
export const makeVariant = (over: Record<string, unknown> = {}): Variant =>
  variantSchema.parse({
    id: 'test',
    name: { es: 'Prueba', en: 'Test' },
    order: 1,
    title: { es: 'Título', en: 'Title' },
    description: {
      es: 'Descripción de prueba con longitud suficiente para cumplir el mínimo de ochenta caracteres.',
      en: 'Test description long enough to satisfy the minimum of eighty characters required here.',
    },
    label: { es: 'Desarrolladora', en: 'Developer' },
    summary: { es: 'Resumen', en: 'Summary' },
    competencies: ['c-py', 'c-node', 'c-ai'],
    ...over,
  });

const baseLabels = {
  summary: 's',
  competencies: 'c',
  work: 'w',
  projects: 'p',
  featuredProjects: 'fp',
  skills: 'sk',
  education: 'e',
  certificates: 'ce',
  languages: 'l',
  technologies: 't',
  present: 'now',
  downloadPdf: 'pdf',
  switchLang: 'x',
  contact: 'ct',
  degreeIn: 'in',
  knowledge: 'k',
  knowledgePersonal: 'kp',
  knowledgeLearning: 'kl',
  knowledgeNote: 'kn',
  courses: 'co',
  coursesKnowledge: 'ck',
  references: 'rf',
  referencesNote: 'rn',
  personalProject: 'pp',
  professionalProject: 'prp',
  inDevelopment: 'dev',
  devStopped: 'stp',
  months: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
};
export const labels: LabelsByLang = { es: baseLabels, en: baseLabels };
