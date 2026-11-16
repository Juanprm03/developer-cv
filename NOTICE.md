# Avisos y atribuciones

## Proyecto original

Este proyecto deriva de [inehosa1/cv](https://github.com/inehosa1/cv), de **Ricardo Andrés Arango Ruiz**.

- La arquitectura, el código, las plantillas (Astro y Typst), los scripts y la documentación para agentes
  (`AGENTS.md` y `CLAUDE.md`) se reutilizan **con autorización del autor**.
- El repositorio original **no declara ninguna licencia**. Este proyecto no asume ninguna, y la
  autorización recibida no implica una licencia abierta (MIT u otra) sobre ese código.
- No se han incorporado el historial Git, los datos personales ni los casos de estudio del proyecto
  original.

<!-- TODO: indicar la fecha y la forma de la autorización (p. ej. mensaje o email) cuando se documente. -->

## Componentes de terceros incluidos en el repositorio

### Fuente Inter (`typst/fonts/*.ttf`)

Copyright (c) 2016 The Inter Project Authors (https://github.com/rsms/inter).
Distribuida bajo la SIL Open Font License 1.1; el texto completo está en
[`typst/fonts/OFL.txt`](./typst/fonts/OFL.txt).

### Iconos Lucide (`src/components/Icon.astro`)

Los trazados SVG de los iconos proceden de [Lucide](https://lucide.dev), bajo la licencia ISC.
Los iconos `arrow-left`, `arrow-right`, `download`, `link` y `lock` derivan del proyecto
[Feather](https://feathericons.com) y están además bajo la licencia MIT. Textos tomados de
https://github.com/lucide-icons/lucide/blob/main/LICENSE:

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

```
The MIT License (MIT) (for the icons derived from Feather)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Dependencias npm

Las dependencias declaradas en `package.json` (Astro, Tailwind CSS, Zod, Mermaid, Playwright, etc.) se
instalan desde npm y conservan sus propias licencias; no se redistribuyen en este repositorio.
