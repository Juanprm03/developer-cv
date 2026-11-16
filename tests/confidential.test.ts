/** Ningún archivo versionable ni CV resuelto contiene nombres internos de productos o clientes. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countConfidential } from '../src/lib/confidential.ts';
import { loadCV, loadVariants } from '../src/lib/cv.ts';
import { LANGS } from '../src/lib/schema.ts';

describe('confidencialidad', () => {
  it('el detector reconoce términos y combinaciones sin guardarlos en claro', () => {
    expect(countConfidential('Ecosistema de ticketing y gestión operativa')).toBe(0);
    // Prueba con un término de control cuyo hash no está en la lista.
    expect(countConfidential('Plataforma de pagos')).toBe(0);
  });

  it('los archivos versionables no contienen nombres internos', () => {
    const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => f && !/(^pnpm-lock|\.(pdf|png|ttf|woff2?|ico)$)/.test(f));
    const leaks = files.filter((f) => {
      try {
        return countConfidential(readFileSync(f, 'utf8')) > 0;
      } catch {
        return false;
      }
    });
    expect(leaks).toEqual([]);
  });

  it.each(loadVariants().flatMap((v) => LANGS.map((l) => [`${v.id}.${l}`, v.id, l] as const)))(
    '%s: el CV resuelto no contiene nombres internos',
    (_, id, lang) => {
      expect(countConfidential(JSON.stringify(loadCV(lang, id)))).toBe(0);
    },
  );
});
