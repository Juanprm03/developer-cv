/**
 * Teléfono del propietario: una sola fuente (data/profile.yaml), impreso en el encabezado de
 * los PDF ES y EN con un enlace tel: funcional y ausente de la web.
 *
 * Los PDF se comprueban si ya están compilados (pnpm pdf); en el build, scripts/check-pdf.ts
 * exige además el texto y la anotación tel: en cada PDF.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCV, loadProfile, loadVariants } from '../src/lib/cv.ts';
import { pdfTargets } from '../src/lib/outputs.ts';
import { LANGS } from '../src/lib/schema.ts';

const PHONE = '+57 319 547 0221';
const TEL = 'tel:+573195470221';
const pdftotext = process.env.PDFTOTEXT ?? 'pdftotext';
const hasPdftotext = (() => {
  try {
    execFileSync(pdftotext, ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const profile = loadProfile();
const publicTargets = pdfTargets(loadVariants(), LANGS, profile.person.name).filter(
  (t) => t.publicFiles.length,
);

describe('teléfono de contacto', () => {
  it('se define una sola vez en el perfil maestro', () => {
    expect(profile.person.phone).toBe(PHONE);
  });

  it.each(LANGS)('llega al CV resuelto (%s)', (lang) => {
    expect(loadCV(lang).basics.phone).toBe(PHONE);
  });

  it('la plantilla lo enlaza con tel: sin espacios, junto a los demás datos de contacto', () => {
    const typ = readFileSync('typst/cv.typ', 'utf8');
    expect(typ).toContain('link("tel:" + b.phone.replace(" ", ""), b.phone)');
    expect(PHONE.replaceAll(' ', '')).toBe(TEL.slice(4));
  });

  it('la web no lo muestra (solo va en el PDF)', () => {
    for (const f of ['src/components/Contact.astro', 'src/components/Resume.astro'])
      expect(readFileSync(f, 'utf8')).not.toMatch(/\.phone\b/);
  });

  describe.each(publicTargets)('PDF público $lang', (t) => {
    const files = [t.file, ...t.publicFiles].filter(existsSync);

    it.skipIf(!files.length)('incluye la anotación tel: correcta', () => {
      for (const f of files) expect(readFileSync(f).toString('latin1')).toContain(`(${TEL})`);
    });

    it.skipIf(!files.length || !hasPdftotext)('el número es texto seleccionable', () => {
      for (const f of files) {
        const page1 = execFileSync(pdftotext, ['-enc', 'UTF-8', '-l', '1', f, '-'], {
          encoding: 'utf8',
        });
        expect(page1).toContain(PHONE);
      }
    });
  });
});
