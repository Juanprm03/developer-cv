# Arquitectura y reglas del proyecto

Documentación técnica de developer-cv: arquitectura, estructura, comandos y reglas de contenido y
código que mantienen las pruebas y las verificaciones del build.

## Objetivo del proyecto

Portafolio profesional bilingüe (ES/EN) y **CV as Code** del propietario del repositorio. Un único
**perfil maestro** genera:

1. **Sitio web** (Astro, GitHub Pages): home, catálogo de proyectos, casos de estudio MDX y CV web.
2. **PDF** compatibles con ATS (Typst) para cada **variante profesional** y cada idioma.

Nunca se edita contenido en las plantillas: solo en `data/` (hechos) y en los MDX (narrativa).

## Arquitectura

```
data/profile.yaml ─┐  (hechos, ids estables, textos { es, en })
data/labels.yaml  ─┼─► Zod ─► resolveCV(perfil, variante, idioma) ─► CV (cvSchema)
data/variants/*.yaml┘          src/lib/resolve.ts (puro)                 │
                                                       ┌─────────────────┴──────────────┐
                                     Astro: loadCV(lang) = variante default   build-pdf: .cache/cv/<v>.<lang>.json
                                     + loadProjects(lang) = perfil + MDX      → typst → public/cv-<v>-<lang>.pdf
```

- **Perfil maestro** (`data/profile.yaml`, esquema `src/lib/profile-schema.ts`): experiencia, proyectos,
  habilidades, logros, competencias, formación e idiomas, cada uno con `id` estable en kebab-case.
  El esquema valida integridad referencial (skills, proyectos, empleos), ids únicos y cronología.
- **Contexto de habilidades**: `professional` (usada en un empleo), `personal` (usada en un proyecto
  personal; el esquema lo exige) o `learning` (en formación, sin uso demostrado). Solo `professional`
  puede aparecer en empleos, en proyectos profesionales o como habilidad destacada. Lo demás solo en
  `knowledge` (sección rotulada por contexto) y en el bloque "Stack por nivel" de la web.
- **Áreas de experiencia** (`capabilities`) y **tipos de producto** (`site.domains`): contenido de la
  web que relaciona habilidades con empleos y proyectos concretos; cada área debe citar evidencia.
- **Variantes** (`data/variants/<id>.yaml`, esquema `src/lib/variant-schema.ts`): seleccionan, ordenan
  y priorizan hechos por id o etiqueta. Sus únicos textos libres son `label`, `title`, `description` y
  `summary`; `src/lib/integrity.ts` impide que introduzcan tecnologías o cifras ajenas al perfil y
  que nombren formación sin declararla en `knowledge`. Variantes: `general` (default y **única
  pública**: `cv-es.pdf`, `cv-en.pdf`, `CV_Juan_Pablo_Ruiz_Marin.pdf` y
  `Juan_Pablo_Ruiz_Marin_Resume.pdf`), y las internas `backend-python`, `backend-node`,
  `ai-developer` y `java-spring` (opcional), que se generan solo en `private/cv/` (gitignored).
  `scripts/check-public.ts` y `tests/outputs.test.ts` impiden que lleguen a `dist/`.
- **Resolutor puro** (`src/lib/resolve.ts`): `selectVariant` (independiente del idioma → paridad
  ES/EN por construcción) + `renderCV` (proyección a un idioma). Salida: `cvSchema` (`src/lib/schema.ts`),
  el contrato que consumen Astro y Typst.
- **Casos de estudio**: `src/content/projects/{es,en}/<id>.mdx` con slug = id de un proyecto del perfil
  con `caseStudy: true`. Los hechos (empresa, rol, estado, stack, enlaces, métricas, confidencialidad)
  salen del perfil; el MDX solo aporta `tagline`, `order`, `featured` y la narrativa con diagramas.

## Stack

| Capa | Tecnología |
|------|-----------|
| Datos | YAML + Zod 4 (perfil, variantes, etiquetas) → JSON Schema en `schema/` para el editor |
| Web | Astro 7 + TypeScript estricto + Tailwind CSS 4 · Inter Variable + JetBrains Mono (self-hosted) |
| Casos de estudio | MDX en content collection · Mermaid → SVG en build (rehype-mermaid + Playwright) |
| PDF | Typst 0.15.1 (lee el CV resuelto en JSON) |
| Calidad | Vitest · Biome 2 · `astro check` · pdftotext (poppler) · axe-core (Playwright) |
| CI/CD | GitHub Actions → GitHub Pages |

Node **24** (`.nvmrc`) · pnpm 10 · Typst 0.15.1.

## Estructura

```
developer-cv/
├── data/
│   ├── profile.yaml          # Perfil maestro (fuente única de hechos)
│   ├── labels.yaml           # Etiquetas de interfaz del CV (web y PDF), ES/EN
│   └── variants/*.yaml       # general, backend-python, backend-node, ai-developer, java-spring
├── schema/                   # Generado por `pnpm validate` (autocompletado YAML)
├── src/
│   ├── lib/
│   │   ├── schema.ts         # cvSchema: contrato de SALIDA
│   │   ├── profile-schema.ts # Perfil maestro + integridad referencial y cronología
│   │   ├── variant-schema.ts # Variantes
│   │   ├── resolve.ts        # Resolutor puro (select + render)
│   │   ├── integrity.ts      # Guardas de textos libres, casos de estudio, placeholders
│   │   ├── cv.ts             # Carga memoizada: loadProfile/loadVariants/loadCV
│   │   ├── projects.ts       # Modelo de vista: perfil + MDX; filtros calculados
│   │   ├── i18n.ts           # Rutas, anclas y textos de INTERFAZ (sin datos profesionales)
│   │   └── mermaid-theme.mjs # Tema Mermaid (sincronizar con global.css)
│   ├── components/           # Home, Resume, ProjectsIndex, ProjectDetail, ProjectCard, SiteNav…
│   ├── layouts/Base.astro    # <head> SEO + script de motion (APIs nativas)
│   ├── content/projects/{es,en}/<id>.mdx
│   └── styles/global.css     # Tokens Midnight Engineering + motion + impresión
├── typst/cv.typ · og.typ · fonts/
├── scripts/
│   ├── validate.ts           # Esquemas, variantes, casos de estudio, accDescr; --release
│   ├── build-pdf.ts          # PDF internos (private/cv/) + CV público (public/, no versionado) + OG
│   ├── check-public.ts       # dist/ sin variantes internas
│   ├── check-pdf.ts          # pdftotext, enlaces, alias, reproducibilidad
│   ├── check-links.ts        # Enlaces internos y anclas en dist/
│   └── a11y.ts               # axe (2 viewports), sin JS, teclado
└── tests/                    # Vitest: resolutor (fixture ficticio) + invariantes de datos reales
```

## Comandos

```bash
pnpm install
pnpm dev            # PDFs + web en http://localhost:4321/developer-cv/ (WSL2/LAN: pnpm dev --host 0.0.0.0)
pnpm validate       # Esquemas + variantes + casos de estudio
pnpm test           # Vitest (resolutor, integridad, paridad)
pnpm check          # validate + astro check + biome
pnpm pdf            # PDF: private/cv/cv-<variante>-<lang>.pdf + CV público en public/ (no versionado)
pnpm pdf:check      # Verifica PDFs con pdftotext (PDFTOTEXT=/ruta si no está en el PATH)
pnpm pdf:watch      # Recompila la variante general al guardar data/, typst/ o src/lib/
pnpm build          # validate + pdf + pdf:check + astro build + check:links + check:public
pnpm a11y           # Auditoría de accesibilidad sobre dist/
pnpm release        # build en modo publicación: falla si queda algún placeholder o TODO
```

Los scripts `.ts` se ejecutan con Node (type stripping): imports con extensión `.ts` y sin sintaxis
TypeScript no borrable (enums, namespaces). Typst debe estar en el PATH (`~/.local/bin`).

## Reglas de contenido (obligatorias)

- **No inventar información.** Cada hecho del perfil debe tener fuente. Niveles de evidencia:
  1. *Verificado*: código o historial de Git propio.
  2. *Declarado*: CV previos aprobados por el propietario sin repositorio disponible → redactar como
     "participación" o "en desarrollo" y listarlo como pendiente.
  3. *No respaldado*: no se publica. En los MDX va como comentario `{/* REVISAR: … */}` (no se
     renderiza; `pnpm validate` lo lista como aviso). Si falta un dato, `TODO` en el YAML y avisar.
- **Confidencialidad de terceros**: nunca nombres de compañeros, proveedores de pago, identificadores
  de tareas, rutas internas ni datos de clientes, aunque aparezcan en los repositorios revisados.
- **Nombres internos de productos y clientes**: los proyectos de empresa se publican con títulos
  descriptivos e ids neutrales (p. ej. `payments-platform`), también en slugs, SEO, JSON-LD, PDF y
  código fuente. `src/lib/confidential.ts` guarda solo hashes de los términos prohibidos; lo usan
  `tests/confidential.test.ts` (archivos versionables y CV resueltos) y `scripts/check-public.ts`
  (dist/, PDF e imagen OG). Para añadir un término, agrega su hash, nunca el término en claro.
- **Contribución personal**: cada caso de estudio distingue lo que hizo el propietario (según el
  historial de Git) de lo que construyó el equipo.
- **Métricas solo verificables**, con su matiz ("reducción reportada"). En YAML, cifras entre comillas.
- **Formación ≠ experiencia**: Java, Spring Boot, Angular y MongoDB tienen contexto `learning`; Django,
  DRF, pytest, Astro o Typst son `personal`. Las pruebas impiden presentarlos como experiencia laboral.
- **Confidencialidad** (`confidential: true`, proyectos de empresa): sin enlaces a código privado,
  rutas internas, nombres de proveedores o clientes, credenciales ni datos de usuarios.
- **Estado de proyecto** (`status`) solo si está confirmado; si se omite, no se muestra.
- **Referencias profesionales** (`src/lib/references.ts`): datos de terceros con consentimiento,
  fuera del repositorio (`private/references.yaml` o secreto `CV_REFERENCES`). `build-pdf.ts` las
  añade solo al JSON de Typst; no forman parte de `cvSchema`, así que la web no puede mostrarlas.
  `check-pdf.ts` comprueba texto y enlaces `tel:`/`mailto:`; `check-public.ts`, que no aparezcan en
  `dist/` fuera del texto de los PDF ni en sus metadatos.
- **Sin datos sensibles** en el CV: nada de foto, edad, estado civil, documento ni dirección completa.
- Logros: verbo + qué + impacto; rol reciente con más detalle. Fechas `YYYY-MM`.
- Al redactar el `summary` de una variante: solo hechos del perfil; las pruebas comprueban cifras y
  tecnologías, pero la veracidad semántica requiere revisión humana.

## Reglas técnicas

- **Una sola fuente de verdad:** hechos en `data/profile.yaml`; textos de interfaz en
  `data/labels.yaml` (CV) y `src/lib/i18n.ts` (sitio). Ninguna cadena profesional en componentes.
- Al añadir un campo: perfil (`profile-schema.ts`) → resolutor → `cvSchema` → Astro y Typst, en el
  mismo cambio, con pruebas.
- **ATS (PDF):** una columna, encabezados estándar, fuentes embebidas, texto extraíble literal
  (lo verifica `check-pdf.ts`), enlaces como anotaciones, máximo `maxPages` por variante.
- **Diagramas Mermaid:** cada bloque debe tener `accTitle` y `accDescr` (texto alternativo; lo valida
  `pnpm validate`). Preferir `flowchart` con nodos agrupados (≤ ~1100 px de ancho).
- **Flujos funcionales:** `src/components/mdx/Flow.astro` (`<Flow lang title steps />`, etapas
  `{title, text, actor?}`). Sin JS es una lista ordenada completa; con JS, un recorrido navegable
  (pestañas ARIA, flechas/Inicio/Fin). Los casos con `<Flow>` siguen 8 secciones fijas (Problema,
  Solución, Flujo funcional, Arquitectura conceptual, Mi contribución, Stack, Retos técnicos,
  Resultados verificables) y deben tener el mismo flujo en ES y EN (`tests/cases.test.ts`,
  `scripts/validate.ts`). Las etapas son abstracciones: sin endpoints, proveedores ni credenciales.
- **Web:** HTML semántico, un `<h1>`, landmarks únicos, WCAG 2.2 AA (contrastes documentados en
  `global.css`), foco visible, `lang` y `hreflang` correctos, canonical, Open Graph y JSON-LD.
- **Identidad Midnight Engineering:** solo modo oscuro (más impresión). Tokens en `global.css`;
  sincronizar colores con `typst/cv.typ`, `typst/og.typ` y `mermaid-theme.mjs`.
- **Motion** (requisito del producto, siempre accesible):
  - Solo `transform`/`opacity` (el hero añade un leve `blur` en escritorio). Sin animaciones infinitas.
  - Revelados con IntersectionObserver (`data-reveal`); el estado oculto depende de
    `html.reveal-ready`, que se añade solo con el observer activo: sin JS todo es visible.
  - Hero: entrada escalonada en CSS (`data-stagger`, `--i`); se omite al cambiar de idioma
    (`html.no-intro`) para que no se superpongan los textos de ambos idiomas.
  - View Transitions entre documentos (`@view-transition`), omitidas al cambiar de idioma.
  - Foco que sigue al cursor solo con `(hover: hover) and (pointer: fine)`.
  - Todo se desactiva con `prefers-reduced-motion: reduce`; en móvil, animaciones más cortas.
- **CSS incrustado** (`build.inlineStylesheets: 'always'`): GitHub Pages cachea el HTML y borra los
  assets con hash anteriores; no volver a CSS/JS externos con hash. Scripts de página `is:inline`.
- Biome no entiende el uso de variables en `.astro`: no borrar imports "sin usar" en `.astro`.
- TypeScript `strictest`; sin `any`.

## Flujo de trabajo

1. Contenido → YAML/MDX → `pnpm validate && pnpm test` → `pnpm pdf && pnpm pdf:check`.
2. Diseño → `pnpm dev` a 375, 768 y 1280 px, con y sin reduced motion → `pnpm build && pnpm a11y`.
3. Antes de publicar: `pnpm check && pnpm test && pnpm release && pnpm a11y`.
4. Conventional Commits (`feat:`, `fix:`, `content:`, `docs:`, `test:`).

## Despliegue

- Push a `main` → GitHub Actions: check → test → build (PDF + verificación + web + enlaces) → a11y →
  GitHub Pages. En pull requests no se publica: los PDF quedan como artefacto `cv-pdf`.
- URLs: home `https://juanprm03.github.io/developer-cv/` y `/en/`; CV `/curriculum/` y `/en/resume/`;
  proyectos `/proyectos/` y `/en/projects/`; CV público `/CV_Juan_Pablo_Ruiz_Marin.pdf` (ES) y
  `/Juan_Pablo_Ruiz_Marin_Resume.pdf` (EN), con los alias `/cv-es.pdf` y `/cv-en.pdf` (solo General Fullstack).
- `SITE` y `BASE_PATH` los inyecta `actions/configure-pages`; valores locales en `astro.config.mjs`.
- Rebuild mensual programado (mantiene al día la duración de un empleo en curso).
