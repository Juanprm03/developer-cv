/**
 * Destinos de los PDF. Pura (sin E/S) para poder probarla.
 *
 * - Públicos (public/ → dist/ → GitHub Pages): solo la variante marcada `public`, con nombres
 *   estables por idioma: cv-es.pdf y cv-en.pdf.
 * - Internos (private/cv/, ignorado por git, fuera de public/): TODAS las variantes, para
 *   postulaciones. Nunca se copian a public/ ni aparecen en el sitio.
 */
import type { Lang } from './schema.ts';

export const PRIVATE_DIR = 'private/cv';
export const PUBLIC_DIR = 'public';

/** Ruta pública histórica del CV de un idioma (se conserva por compatibilidad). */
export const publicPdfPath = (lang: Lang) => `/cv-${lang}.pdf`;

/**
 * Nombre de descarga del CV público: ES `CV_Nombre_Apellido.pdf`, EN `Nombre_Apellido_Resume.pdf`.
 * Se publica también con ese nombre para que los enlaces directos descarguen igual.
 */
export function publicDownloadName(name: string, lang: Lang): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return lang === 'es' ? `CV_${base}.pdf` : `${base}_Resume.pdf`;
}

/** Enlace de descarga del CV público (archivo con nombre propio). */
export const publicCvHref = (name: string, lang: Lang) => `/${publicDownloadName(name, lang)}`;
export const privatePdfFile = (variant: string, lang: Lang) =>
  `${PRIVATE_DIR}/cv-${variant}-${lang}.pdf`;

export interface PdfTarget {
  variant: string;
  lang: Lang;
  /** Archivo interno generado por Typst. */
  file: string;
  /** Copias públicas (ruta histórica y nombre de descarga), solo para la variante pública. */
  publicFiles: string[];
}

export function pdfTargets(
  variants: { id: string; public: boolean }[],
  langs: readonly Lang[],
  name: string,
): PdfTarget[] {
  return variants.flatMap((v) =>
    langs.map((lang) => ({
      variant: v.id,
      lang,
      file: privatePdfFile(v.id, lang),
      publicFiles: v.public
        ? [`${PUBLIC_DIR}${publicPdfPath(lang)}`, `${PUBLIC_DIR}${publicCvHref(name, lang)}`]
        : [],
    })),
  );
}

/** Todos los PDF públicos permitidos (para check-public). */
export const allowedPublicPdfs = (name: string, langs: readonly Lang[]) =>
  langs.flatMap((l) => [publicPdfPath(l), publicCvHref(name, l)]);
