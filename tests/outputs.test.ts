/** Las variantes especializadas son internas: nunca se publican en el sitio. */
import { describe, expect, it } from 'vitest';
import { loadVariants } from '../src/lib/cv.ts';
import {
  PRIVATE_DIR,
  PUBLIC_DIR,
  pdfTargets,
  publicDownloadName,
  publicPdfPath,
} from '../src/lib/outputs.ts';
import { LANGS } from '../src/lib/schema.ts';

describe('salida de los PDF', () => {
  const variants = loadVariants();
  const targets = pdfTargets(variants, LANGS, 'Juan Pablo Ruiz Marín');

  it('solo la variante General Fullstack es pública', () => {
    expect(variants.filter((v) => v.public).map((v) => v.id)).toEqual(['general']);
  });

  it('todas las variantes se generan en el directorio privado', () => {
    expect(targets).toHaveLength(variants.length * LANGS.length);
    for (const t of targets) expect(t.file.startsWith(`${PRIVATE_DIR}/`)).toBe(true);
  });

  it('el CV público se publica con la ruta histórica y con el nombre de descarga', () => {
    const pub = targets.flatMap((t) => t.publicFiles);
    expect(pub).toEqual([
      'public/cv-es.pdf',
      'public/CV_Juan_Pablo_Ruiz_Marin.pdf',
      'public/cv-en.pdf',
      'public/Juan_Pablo_Ruiz_Marin_Resume.pdf',
    ]);
    expect(pub.filter((f) => f.startsWith(`${PUBLIC_DIR}/cv-`))).toEqual(
      LANGS.map((l) => `${PUBLIC_DIR}${publicPdfPath(l)}`),
    );
  });

  it('nombres de descarga sin tildes ni espacios', () => {
    expect(publicDownloadName('Juan Pablo Ruiz Marín', 'es')).toBe('CV_Juan_Pablo_Ruiz_Marin.pdf');
    expect(publicDownloadName('Juan Pablo Ruiz Marín', 'en')).toBe(
      'Juan_Pablo_Ruiz_Marin_Resume.pdf',
    );
  });

  it('las variantes internas no tienen copia pública', () => {
    for (const t of targets.filter((x) => x.variant !== 'general'))
      expect(t.publicFiles).toEqual([]);
  });

  it('el directorio privado queda fuera de public/', () => {
    expect(PRIVATE_DIR.startsWith(PUBLIC_DIR)).toBe(false);
  });
});
