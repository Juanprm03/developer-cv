# developer-cv

> ⚠️ **Estado: plantilla con datos de ejemplo.** Todo el contenido de `data/*.yaml` y de
> `src/content/projects/` es *placeholder* (`[PLACEHOLDER]`) y todavía no describe a ninguna persona real.

CV como código: **una sola fuente de datos** (`data/cv.*.yaml`) genera

- 🌐 un portafolio web estático, bilingüe y accesible → `https://juanprm03.github.io/developer-cv/` (CV en `/curriculum/`)
- 🧩 una landing de casos de estudio técnicos con diagramas → `/proyectos/`
- 📄 un PDF compatible con ATS → `/cv-es.pdf` · `/cv-en.pdf`

Stack: Astro 7 · MDX · Mermaid · Tailwind CSS 4 · Typst · Zod · Biome · GitHub Actions/Pages.

## Uso

```bash
nvm use            # Node 24
pnpm install
pnpm dev           # http://localhost:4321/developer-cv/
```

Requiere [Typst](https://github.com/typst/typst/releases) 0.15.1 en el PATH y Chromium de Playwright
(`pnpm exec playwright install chromium`) para los diagramas.

Para editar el contenido, modifica `data/cv.es.yaml` y `data/cv.en.yaml` y ejecuta `pnpm check`.
Las reglas de contenido y de código están en [`AGENTS.md`](./AGENTS.md).

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
