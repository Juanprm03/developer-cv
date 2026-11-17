/**
 * Reglas de integridad que comparten scripts/validate.ts y los tests.
 * Funciones puras: reciben datos ya cargados y devuelven una lista de errores.
 */
import type { Profile } from './profile-schema.ts';
import { LANGS } from './schema.ts';
import type { Variant } from './variant-schema.ts';

/**
 * Tecnologías conocidas que una variante podría intentar "colar" en sus textos libres.
 * Si aparece una en el titular, título, descripción o resumen, debe existir en el perfil.
 */
export const TECH_LEXICON = [
  'Java',
  'Spring Boot',
  'Spring',
  'Kotlin',
  'Golang',
  'Rust',
  'C#',
  '.NET',
  'Ruby',
  'Rails',
  'Kubernetes',
  'Terraform',
  'GraphQL',
  'Kafka',
  'RabbitMQ',
  'Angular',
  'Vue',
  'Svelte',
  'Azure',
  'GCP',
  'Google Cloud',
  'Firebase',
  'MongoDB',
  'DynamoDB',
  'Elasticsearch',
  'Spark',
  'Airflow',
  'TensorFlow',
  'PyTorch',
  'Hugging Face',
  'LangGraph',
  'Anthropic',
  'Gemini',
  'Llama',
  'Flask',
  'Django',
  'Django REST Framework',
  'pytest',
  'Jest',
  'Cypress',
  'Playwright',
  'Selenium',
  'Next.js',
  'Nuxt',
  'Express',
  'NestJS',
  'FastAPI',
  'Laravel',
  'PHP',
  'Python',
  'Node.js',
  'TypeScript',
  'JavaScript',
  'React',
  'Redis',
  'PostgreSQL',
  'MySQL',
  'pgvector',
  'LangChain',
  'OpenAI',
  'MCP',
  'Claude',
  'AWS',
  'Docker',
  'Prisma',
  'Inertia',
  'WhatsApp',
  'Typst',
  'Astro',
  'Zod',
  'Tailwind',
  'GitHub Actions',
  'Scrum',
  'RAG',
] as const;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text: string, term: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);

/** Todos los textos de hechos del perfil, en todos los idiomas. */
export function factCorpus(profile: Profile): string {
  const parts: string[] = [];
  const add = (l?: Record<string, string>) => {
    if (l) for (const lang of LANGS) parts.push(l[lang] ?? '');
  };
  for (const s of profile.skills) parts.push(s.name);
  for (const c of profile.competencies) add(c.text);
  for (const w of profile.work) {
    parts.push(w.company);
    add(w.position);
    add(w.summary);
    for (const h of w.highlights) add(h.text);
  }
  for (const p of profile.projects) {
    add(p.name);
    add(p.description);
    for (const h of p.highlights) add(h.text);
    if (p.cv?.name) add(p.cv.name);
    if (p.cv?.description) add(p.cv.description);
    for (const h of p.cv?.highlights ?? []) add(h.text);
  }
  return parts.join('\n');
}

/**
 * Los textos libres de una variante no pueden introducir tecnologías ni cifras ajenas
 * al perfil, y solo pueden nombrar habilidades no profesionales si las declara en
 * `knowledge` (es decir, si las presenta explícitamente como formación).
 */
export function checkVariantFreeText(profile: Profile, variant: Variant): string[] {
  const errors: string[] = [];
  const corpus = factCorpus(profile);
  const nonProfessional = profile.skills.filter((s) => s.context !== 'professional');
  for (const lang of LANGS) {
    const fields = {
      label: variant.label[lang],
      title: variant.title[lang],
      description: variant.description[lang],
      summary: variant.summary[lang],
    };
    for (const [field, text] of Object.entries(fields)) {
      const where = `variants/${variant.id}.${field}.${lang}`;
      for (const term of TECH_LEXICON)
        if (mentions(text, term) && !mentions(corpus, term))
          errors.push(`${where}: menciona "${term}", que no figura en el perfil`);
      for (const s of nonProfessional)
        if (mentions(text, s.name) && !variant.knowledge.includes(s.id))
          errors.push(`${where}: menciona "${s.name}" (${s.context}) sin declararlo en knowledge`);
      for (const n of text.match(/\d+(?:[.,]\d+)*/g) ?? [])
        if (!corpus.includes(n)) errors.push(`${where}: la cifra "${n}" no figura en el perfil`);
    }
  }
  return errors;
}

/**
 * Casos de estudio: cada proyecto con `caseStudy: true` necesita su MDX en todos los
 * idiomas (slug = id), y cada MDX debe corresponder a un proyecto del perfil.
 */
export function checkCaseStudies(profile: Profile, files: Record<string, string[]>): string[] {
  const errors: string[] = [];
  const expected = new Set(profile.projects.filter((p) => p.caseStudy).map((p) => p.id));
  for (const lang of LANGS) {
    const slugs = new Set((files[lang] ?? []).map((f) => f.replace(/\.mdx$/, '')));
    for (const id of expected)
      if (!slugs.has(id)) errors.push(`Falta el caso de estudio ${lang}/${id}.mdx`);
    for (const slug of slugs)
      if (!expected.has(slug))
        errors.push(`${lang}/${slug}.mdx no corresponde a un proyecto con caseStudy: true`);
  }
  return errors;
}

/** Marcadores de contenido pendiente que no pueden llegar a una publicación definitiva. */
export const PLACEHOLDER_PATTERNS = [/\[PLACEHOLDER\]/i, /\bTODO\b/, /\bexample\.com\b/i];

/** Rutas (a.b[2].c) de los textos de un valor que contienen placeholders. */
export function findPlaceholders(value: unknown, path = ''): string[] {
  if (typeof value === 'string')
    return PLACEHOLDER_PATTERNS.some((re) => re.test(value)) ? [`${path}: ${value}`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findPlaceholders(v, `${path}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) =>
      findPlaceholders(v, path ? `${path}.${k}` : k),
    );
  return [];
}
