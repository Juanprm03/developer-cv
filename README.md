# developer-cv

Portafolio profesional bilingüe (ES/EN) y **CV como código** de Juan Pablo Ruiz Marín,
Fullstack Software Developer | Backend, Cloud & AI.

→ **https://juanprm03.github.io/developer-cv/** · [English](https://juanprm03.github.io/developer-cv/en/)

## Qué incluye (V2)

Un **perfil maestro** en YAML (`data/profile.yaml`), validado con Zod, es la única fuente de hechos.
A partir de él se generan:

- 🌐 **Sitio web** estático y accesible con identidad *Midnight Engineering*: experiencia,
  experiencia en cifras, stack por áreas, «Cómo trabajo» y contacto.
- 🧩 **Casos de estudio** en MDX (`/proyectos/`, `/en/projects/`): catálogo con filtros por categoría y
  tecnología, flujos funcionales navegables y diagramas Mermaid accesibles. Los proyectos de empresa se
  presentan con títulos descriptivos y sin datos confidenciales.
- 📄 **CV en PDF** compatible con ATS (Typst, diseño *Executive Tech Minimal*, dos páginas) y su
  versión web (`/curriculum/`, `/en/resume/`).

### CV públicos

| Idioma | Descarga | Alias estable |
|---|---|---|
| Español | [`CV_Juan_Pablo_Ruiz_Marin.pdf`](https://juanprm03.github.io/developer-cv/CV_Juan_Pablo_Ruiz_Marin.pdf) | `/cv-es.pdf` |
| Inglés | [`Juan_Pablo_Ruiz_Marin_Resume.pdf`](https://juanprm03.github.io/developer-cv/Juan_Pablo_Ruiz_Marin_Resume.pdf) | `/cv-en.pdf` |

Los PDF se compilan en cada build (no se versionan). Solo se publica el CV general: las variantes de
`data/variants/` distintas de `general` son herramientas internas de postulación que se generan en
`private/cv/` (ignorado por git) y que `scripts/check-public.ts` impide que lleguen al sitio.

Las **referencias profesionales** son datos de terceros: no se versionan. Se leen de
`private/references.yaml` en local o del secreto de Actions `CV_REFERENCES` en el despliegue, y solo
se imprimen en el PDF (nunca en la web ni en los metadatos). Sin ellas, el CV indica que están
disponibles a solicitud.

## Desarrollo

Requisitos: Node 24 (`.nvmrc`), pnpm 10, [Typst 0.15.1](https://github.com/typst/typst/releases) en
el PATH y `pdftotext` (paquete `poppler-utils`) para verificar los PDF.

```bash
nvm use
pnpm install
pnpm exec playwright install chromium   # diagramas Mermaid y auditoría de accesibilidad
pnpm dev                                # http://localhost:4321/developer-cv/
```

| Comando | Qué hace |
|---|---|
| `pnpm validate` | Esquemas, variantes, casos de estudio y textos alternativos de los diagramas |
| `pnpm check` | `validate` + `astro check` + Biome |
| `pnpm test` | Vitest: resolutor, integridad de datos, paridad ES/EN, filtros, confidencialidad |
| `pnpm pdf` / `pnpm pdf:check` | Compila los PDF y los verifica con pdftotext (texto, enlaces, páginas) |
| `pnpm build` | PDF + web + enlaces internos + comprobación de la salida pública |
| `pnpm release` | `build` en modo publicación: falla si queda algún placeholder |
| `pnpm a11y` | axe en escritorio y móvil, contenido sin JS, teclado, filtros, flujos y descargas |

Validación completa antes de publicar:

```bash
pnpm check && pnpm test && pnpm release && pnpm a11y
```

El despliegue lo hace GitHub Actions al hacer push a `main` (check → test → build → a11y → GitHub
Pages). La arquitectura, la estructura y las reglas de contenido y código están en
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

Stack: Astro · TypeScript · Tailwind CSS · MDX · Mermaid · Typst · Zod · Vitest · Biome ·
Playwright/axe · GitHub Actions/Pages.

## Reconocimiento

La arquitectura y el código de este proyecto se basan en
[**inehosa1/cv**](https://github.com/inehosa1/cv), creado por **Ricardo Andrés Arango Ruiz**, y se
reutilizan con su autorización. Gracias por compartirlo.

Este repositorio parte de una copia limpia: no incluye el historial Git, los datos personales ni los
casos de estudio del proyecto original. Consulta [`NOTICE.md`](./NOTICE.md) para la atribución
completa y los componentes de terceros.

## Licencia

Este repositorio **todavía no declara una licencia**. El proyecto original tampoco la declara, por lo
que no se concede ningún permiso de reutilización adicional sobre su código. Consulta `NOTICE.md`.
