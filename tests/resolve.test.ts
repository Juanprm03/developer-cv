/** Pruebas unitarias del resolutor con un perfil ficticio (tests/fixtures/profile.yaml). */
import { describe, expect, it } from 'vitest';
import { checkVariantFreeText, findPlaceholders } from '../src/lib/integrity.ts';
import { profileSchema } from '../src/lib/profile-schema.ts';
import { renderCV, resolveCV, selectVariant, validateVariant } from '../src/lib/resolve.ts';
import { cvSchema } from '../src/lib/schema.ts';
import { fixtureProfile, fixtureProfileRaw, labels, makeVariant } from './helpers.ts';

const profile = fixtureProfile();
const highlightsOf = (variant = makeVariant(), job = 'acme') =>
  selectVariant(profile, variant).work.find((w) => w.id === job)?.highlights;

describe('selectVariant · logros', () => {
  it('prioriza los logros por etiquetas, ponderando el orden de la variante', () => {
    expect(highlightsOf(makeVariant({ tags: ['ai', 'python'] }))).toEqual([
      'acme-ai', // ai (peso 2) + python (peso 1)
      'acme-py', // python
    ]);
    expect(highlightsOf(makeVariant({ tags: ['node'] }))).toEqual(['acme-node']);
  });

  it('sin etiquetas incluye todos los logros en el orden del perfil', () => {
    expect(highlightsOf()).toEqual(['acme-py', 'acme-node', 'acme-ai', 'acme-misc']);
  });

  it('pin va primero aunque no coincida; exclude nunca aparece', () => {
    const v = makeVariant({
      tags: ['python'],
      highlights: { pin: ['acme-misc'], exclude: ['acme-ai'] },
    });
    expect(highlightsOf(v)).toEqual(['acme-misc', 'acme-py']);
  });

  it('respeta maxPerJob', () => {
    expect(highlightsOf(makeVariant({ highlights: { maxPerJob: 2 } }))).toHaveLength(2);
  });

  it('conserva todos los empleos y al menos un logro en cada uno (sin huecos)', () => {
    const sel = selectVariant(profile, makeVariant({ tags: ['node'] }));
    expect(sel.work.map((w) => w.id)).toEqual(['acme', 'beta']);
    expect(sel.work.find((w) => w.id === 'beta')?.highlights).toEqual(['beta-qa']);
  });
});

describe('selectVariant · habilidades y conocimientos', () => {
  it('solo lista habilidades profesionales y destaca las de la variante', () => {
    const sel = selectVariant(profile, makeVariant({ skills: { featured: ['nodejs'] } }));
    const all = sel.skills.flatMap((c) => [...c.featured, ...c.keywords]);
    expect(all).not.toContain('java');
    expect(all).not.toContain('mongodb');
    expect(sel.skills.find((c) => c.category === 'backend')).toEqual({
      category: 'backend',
      featured: ['nodejs'],
      keywords: ['python'],
    });
  });

  it('ordena categorías según la variante', () => {
    const sel = selectVariant(profile, makeVariant({ skills: { categories: ['ai'] } }));
    expect(sel.skills.map((c) => c.category)).toEqual(['ai', 'backend']);
  });

  it('los conocimientos personales solo aparecen en su sección rotulada', () => {
    const cv = resolveCV({
      profile,
      variant: makeVariant({ knowledge: ['java', 'mongodb'] }),
      labels,
      lang: 'es',
    });
    expect(cv.knowledge).toEqual([
      { name: 'Java', context: 'personal' },
      { name: 'MongoDB', context: 'learning' },
    ]);
    expect(cv.work.flatMap((w) => w.technologies)).not.toContain('Java');
  });
});

describe('renderCV', () => {
  const variant = makeVariant({ projects: ['bot', 'side'] });
  const es = resolveCV({ profile, variant, labels, lang: 'es' });
  const en = resolveCV({ profile, variant, labels, lang: 'en' });

  it('produce un CV que cumple el contrato cvSchema', () => {
    expect(cvSchema.safeParse(es).success).toBe(true);
  });

  it('no altera hechos: empresa, fechas y textos idénticos al perfil', () => {
    expect(es.work[0]).toMatchObject({
      name: 'Acme',
      startDate: '2024-01',
      position: 'Desarrolladora',
    });
    expect(es.work[1]).toMatchObject({ name: 'Beta', startDate: '2023-01', endDate: '2023-12' });
    expect(es.work[0]?.highlights[0]).toBe('Logro Python 40 %');
    expect(en.work[0]?.highlights[0]).toBe('Python win 40%');
  });

  it('enlaza el caso de estudio y no inventa URL para proyectos sin enlace', () => {
    expect(es.projects[0]).toMatchObject({ id: 'bot', caseStudy: 'bot', context: 'professional' });
    expect(es.projects[0]?.url).toBeUndefined();
    expect(es.projects[1]).toMatchObject({
      context: 'personal',
      url: 'https://github.test/ada/side',
    });
  });

  it('deriva la URL por idioma desde la raíz del sitio', () => {
    expect(es.basics.url).toBe('https://ejemplo.test/cv/');
    expect(en.basics.url).toBe('https://ejemplo.test/cv/en/');
  });

  it('paridad: ES y EN tienen la misma estructura', () => {
    const shape = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(shape)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
          : typeof v;
    const strip = (cv: typeof es) => ({ ...cv, meta: { ...cv.meta, labels: null } });
    expect(shape(strip(es))).toEqual(shape(strip(en)));
  });

  it('falla ante referencias rotas en lugar de omitirlas en silencio', () => {
    const sel = selectVariant(profile, variant);
    sel.competencies.push('no-existe');
    expect(() => renderCV(profile, sel, variant, labels, 'es')).toThrow(/Referencia rota/);
  });
});

describe('agrupación de logros', () => {
  const grouped = makeVariant({
    groups: {
      acme: [
        { title: { es: 'Backend', en: 'Backend' }, highlights: ['acme-py', 'acme-node'] },
        { title: { es: 'IA', en: 'AI' }, highlights: ['acme-ai'] },
      ],
    },
    workTechnologies: false,
  });

  it('presenta los logros agrupados, literales y sin lista plana duplicada', () => {
    const cv = resolveCV({ profile, variant: grouped, labels, lang: 'es' });
    const acme = cv.work[0];
    expect(acme?.highlights).toEqual([]);
    expect(acme?.groups).toEqual([
      { name: 'Backend', highlights: ['Logro Python 40 %', 'Logro Node'] },
      { name: 'IA', highlights: ['Logro IA'] },
    ]);
    expect(acme?.technologies).toEqual([]);
    expect(cv.work[1]?.highlights).toEqual(['Logro QA']);
  });

  it('rechaza logros de otro empleo o repetidos entre grupos', () => {
    const bad = makeVariant({
      groups: {
        acme: [
          { title: { es: 'A', en: 'A' }, highlights: ['acme-py', 'beta-qa'] },
          { title: { es: 'B', en: 'B' }, highlights: ['acme-py'] },
        ],
      },
    });
    const errors = validateVariant(profile, bad).join('\n');
    expect(errors).toMatch(/"beta-qa" no es un logro de ese empleo/);
    expect(errors).toMatch(/logros repetidos/);
  });
});

describe('validateVariant', () => {
  it('acepta una variante correcta', () => {
    expect(validateVariant(profile, makeVariant({ tags: ['python'] }))).toEqual([]);
  });

  it('rechaza ids desconocidos', () => {
    const errors = validateVariant(
      profile,
      makeVariant({
        competencies: ['c-py', 'c-node', 'nope'],
        projects: ['ghost'],
        highlights: { pin: ['ghost-hl'] },
        tags: ['typo'],
      }),
    );
    expect(errors.join('\n')).toMatch(/competencia desconocida "nope"/);
    expect(errors.join('\n')).toMatch(/proyecto desconocido "ghost"/);
    expect(errors.join('\n')).toMatch(/logro desconocido "ghost-hl"/);
    expect(errors.join('\n')).toMatch(/etiqueta "typo"/);
  });

  it('impide destacar formación como habilidad profesional', () => {
    const errors = validateVariant(profile, makeVariant({ skills: { featured: ['java'] } }));
    expect(errors.join()).toMatch(/"java" \(personal\) no puede destacarse/);
  });

  it('impide declarar una habilidad profesional como conocimiento en formación', () => {
    const errors = validateVariant(profile, makeVariant({ knowledge: ['python'] }));
    expect(errors.join()).toMatch(/es professional/);
  });

  it('resolveCV lanza si la variante no es válida', () => {
    expect(() =>
      resolveCV({ profile, variant: makeVariant({ projects: ['ghost'] }), labels, lang: 'es' }),
    ).toThrow(/proyecto desconocido/);
  });
});

describe('profileSchema · integridad', () => {
  const broken = (mutate: (p: ReturnType<typeof fixtureProfileRaw>) => void) => {
    const raw = structuredClone(fixtureProfileRaw());
    mutate(raw);
    const r = profileSchema.safeParse(raw);
    return r.success ? '' : r.error.issues.map((i) => i.message).join('\n');
  };
  type Raw = {
    work: {
      technologies: string[];
      startDate: string;
      endDate?: string;
      highlights: { id: string }[];
    }[];
    projects: { work?: string }[];
  };

  it('rechaza formación en las tecnologías de un empleo', () => {
    expect(broken((p) => (p as unknown as Raw).work[0]?.technologies.push('java'))).toMatch(
      /contexto personal: no puede figurar como experiencia laboral/,
    );
  });

  it('rechaza ids duplicados', () => {
    expect(
      broken((p) => {
        const w = (p as unknown as Raw).work[1];
        if (w?.highlights[0]) w.highlights[0].id = 'acme-py';
      }),
    ).toMatch(/id duplicado "acme-py"/);
  });

  it('rechaza cronología incorrecta', () => {
    expect(
      broken((p) => {
        const w = (p as unknown as Raw).work[0];
        if (w) w.endDate = '2023-06';
      }),
    ).toMatch(/endDate es anterior a startDate/);
    expect(
      broken((p) => {
        const w = (p as unknown as Raw).work[1];
        if (w) w.startDate = '2025-01';
      }),
    ).toMatch(/orden cronológico inverso/);
  });

  it('rechaza áreas de experiencia con referencias rotas o sin evidencia', () => {
    type RawCap = { capabilities: { skills: string[]; work: string[]; projects?: string[] }[] };
    expect(
      broken((p) => {
        (p as unknown as RawCap).capabilities[0]?.skills.push('cobol');
      }),
    ).toMatch(/skill desconocida "cobol"/);
    expect(
      broken((p) => {
        const c = (p as unknown as RawCap).capabilities[0];
        if (c) c.work = [];
      }),
    ).toMatch(/al menos un empleo o proyecto como evidencia/);
  });

  it('una habilidad personal sin proyecto personal que la use debe ser learning', () => {
    type RawSkill = { skills: { id: string; context: string }[] };
    expect(
      broken((p) => {
        const s = (p as unknown as RawSkill).skills.find((x) => x.id === 'mongodb');
        if (s) s.context = 'personal';
      }),
    ).toMatch(/"mongodb" es personal pero ningún proyecto personal la usa/);
  });

  it('rechaza un proyecto profesional sin empleo', () => {
    expect(
      broken((p) => {
        const pr = (p as unknown as Raw).projects[0];
        if (pr) delete pr.work;
      }),
    ).toMatch(/debe indicar su empleo/);
  });
});

describe('integridad de textos libres', () => {
  it('detecta tecnologías y cifras ajenas al perfil', () => {
    const v = makeVariant({
      summary: {
        es: 'Experto en Kubernetes con 99 % de éxito',
        en: 'Kubernetes expert, 99% success',
      },
    });
    const errors = checkVariantFreeText(profile, v).join('\n');
    expect(errors).toMatch(/"Kubernetes"/);
    expect(errors).toMatch(/cifra "99"/);
  });

  it('exige declarar en knowledge la formación mencionada', () => {
    const v = makeVariant({ summary: { es: 'Sé Java', en: 'I know Java' } });
    expect(checkVariantFreeText(profile, v).join()).toMatch(/"Java" \(personal\)/);
    expect(checkVariantFreeText(profile, makeVariant({ ...v, knowledge: ['java'] }))).toEqual([]);
  });

  it('acepta cifras y tecnologías que sí figuran en el perfil', () => {
    const v = makeVariant({
      summary: { es: 'Python y Node.js, 40 %', en: 'Python and Node.js, 40%' },
    });
    expect(checkVariantFreeText(profile, v)).toEqual([]);
  });

  it('findPlaceholders localiza marcadores pendientes', () => {
    expect(
      findPlaceholders({ a: ['ok', '[PLACEHOLDER] x'], b: { c: 'TODO: y', d: 'me@example.com' } }),
    ).toEqual(['a[1]: [PLACEHOLDER] x', 'b.c: TODO: y', 'b.d: me@example.com']);
  });
});
