/**
 * Auditoría de accesibilidad y mejora progresiva del sitio generado (dist/).
 *
 * - axe-core (WCAG 2.0/2.1/2.2 A y AA) en todas las páginas, en escritorio y móvil, con
 *   `prefers-reduced-motion: reduce` para auditar el estado final sin animaciones.
 * - Sin JavaScript: todo el contenido revelable es visible y la navegación móvil existe.
 * - Teclado: el primer elemento enfocable es el enlace "Saltar al contenido" y el menú
 *   móvil se abre/cierra con teclado (Enter / Escape) con aria-expanded coherente.
 *
 * Sirve dist/ con un servidor estático propio. Requiere Chromium de Playwright.
 */
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { loadProfile } from '../src/lib/cv.ts';
import { publicDownloadName } from '../src/lib/outputs.ts';

const DIST = 'dist';
const base = (process.env.BASE_PATH ?? '/developer-cv').replace(/\/$/, '');
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith(base)) {
    res.writeHead(404).end();
    return;
  }
  path = join(DIST, path.slice(base.length));
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
  if (!existsSync(path)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(res);
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const pages = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : p.endsWith('index.html') ? [p] : [];
  });
const routes = pages(DIST).map(
  (p) => `${base}/${p.slice(DIST.length + 1).replace(/index\.html$/, '')}`,
);

const browser = await chromium.launch();
const errors: string[] = [];
const warnings: string[] = [];

// 1. axe en escritorio y móvil.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    for (const v of result.violations) {
      const msg = `${route} @${viewport.width}px · ${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(', ')}`;
      if (v.impact === 'serious' || v.impact === 'critical') errors.push(msg);
      else warnings.push(msg);
    }
  }
  await context.close();
}

// 2. Sin JavaScript: nada queda oculto por el sistema de motion.
{
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(origin + route, { waitUntil: 'load' });
    await page.waitForTimeout(1200); // fin de la entrada CSS del hero
    const hidden = await page.$$eval(
      '[data-reveal], [data-stagger] > *',
      (els) =>
        els.filter(
          (el) => el.getClientRects().length > 0 && Number(getComputedStyle(el).opacity) < 1,
        ).length,
    );
    if (hidden) errors.push(`${route} sin JS: ${hidden} elementos con opacidad < 1`);
    const menuLinks = await page.$$eval(
      '#mobile-menu a',
      (els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).length,
    );
    if (!menuLinks) errors.push(`${route} sin JS: la navegación móvil no es visible`);
  }
  await context.close();
}

// 3. Teclado: enlace de salto y menú móvil.
{
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(`${origin}${base}/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.getAttribute('href'));
  if (first !== '#main') errors.push(`Teclado: el primer foco es ${first}, no el enlace de salto`);

  const toggle = page.locator('[data-menu-toggle]');
  await toggle.focus();
  await page.keyboard.press('Enter');
  const open = await toggle.getAttribute('aria-expanded');
  const visible = await page.locator('#mobile-menu a').first().isVisible();
  const focusInMenu = await page.evaluate(() => !!document.activeElement?.closest('#mobile-menu'));
  await page.keyboard.press('Escape');
  const closed = await toggle.getAttribute('aria-expanded');
  const focusBack = await page.evaluate(() =>
    document.activeElement?.hasAttribute('data-menu-toggle'),
  );
  if (open !== 'true' || !visible) errors.push('Teclado: Enter no abre el menú móvil');
  if (!focusInMenu) errors.push('Teclado: al abrir el menú el foco no entra en él');
  if (closed !== 'false' || !focusBack)
    errors.push('Teclado: Escape no cierra el menú ni devuelve el foco');
  await context.close();
}

// 4. Filtros del catálogo: categoría, tecnología, combinación vacía, restablecer y teclado.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  await page.goto(`${origin}${base}/proyectos/`, { waitUntil: 'networkidle' });
  const visible = () => page.locator('[data-project]:not([hidden])').count();
  const total = await page.locator('[data-project]').count();
  const expected = (cat: string, tech: string) =>
    page.$$eval(
      '[data-project]',
      (els, [c, t]) =>
        els.filter(
          (e) =>
            (c === 'all' || (e as HTMLElement).dataset.categories?.split(' ').includes(c ?? '')) &&
            (t === 'all' || (e as HTMLElement).dataset.techs?.split(' ').includes(t ?? '')),
        ).length,
      [cat, tech],
    );
  const where = `Filtros @${viewport.width}px`;
  if ((await visible()) !== total) errors.push(`${where}: no se muestran todos al inicio`);
  await page.locator('[data-category="backend"]').click();
  if ((await visible()) !== (await expected('backend', 'all')))
    errors.push(`${where}: la categoría Backend no filtra correctamente`);
  if ((await page.locator('[data-category="backend"]').getAttribute('aria-pressed')) !== 'true')
    errors.push(`${where}: aria-pressed no refleja la categoría activa`);
  await page.selectOption('[data-tech]', 'django');
  if ((await visible()) !== (await expected('backend', 'django')) || (await visible()) === 0)
    errors.push(`${where}: la combinación categoría + tecnología no funciona`);
  await page.locator('[data-category="frontend"]').click();
  if ((await visible()) !== 0 || !(await page.locator('[data-empty]').isVisible()))
    errors.push(`${where}: falta el estado vacío`);
  await page.locator('[data-empty] [data-reset]').click();
  if ((await visible()) !== total || (await page.locator('[data-tech]').inputValue()) !== 'all')
    errors.push(`${where}: restablecer no devuelve todos los proyectos`);
  await page.locator('[data-category="ai"]').focus();
  await page.keyboard.press('Enter');
  if ((await visible()) !== (await expected('ai', 'all')))
    errors.push(`${where}: los filtros no responden al teclado`);
  await page.close();
}

// 5. Descarga del CV: nombre correcto en todos los CTA y archivo disponible.
{
  const name = loadProfile().person.name;
  const page = await browser.newPage();
  for (const [route, lang] of [
    ['/', 'es'],
    ['/en/', 'en'],
    ['/curriculum/', 'es'],
    ['/en/resume/', 'en'],
  ] as const) {
    await page.goto(`${origin}${base}${route}`, { waitUntil: 'networkidle' });
    const links = await page.$$eval('a[type="application/pdf"]', (els) =>
      els.map((e) => ({
        href: e.getAttribute('href') ?? '',
        download: e.getAttribute('download'),
      })),
    );
    const file = publicDownloadName(name, lang);
    if (!links.length) errors.push(`${route}: no hay CTA de descarga del CV`);
    for (const l of links) {
      if (l.download !== file)
        errors.push(`${route}: descarga como "${l.download}" en lugar de ${file}`);
      if (!l.href.endsWith(`/${file}`)) errors.push(`${route}: el enlace no apunta a ${file}`);
    }
    const res = await page.request.get(`${origin}${base}/${file}`);
    if (!res.ok()) errors.push(`${route}: ${file} no está disponible (${res.status()})`);
  }
  await page.close();
}

// 6. Responsive: sin desbordamiento horizontal en las páginas clave.
for (const width of [390, 768, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  for (const route of [
    '/',
    '/en/',
    '/proyectos/',
    '/proyectos/ticketing-ecosystem/',
    '/curriculum/',
  ]) {
    await page.goto(`${origin}${base}${route}`, { waitUntil: 'networkidle' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0)
      errors.push(`${route} @${width}px: desbordamiento horizontal de ${overflow}px`);
  }
  await page.close();
}

// 7. Flujos de los casos de estudio: teclado, botones, móvil y sin JS.
{
  const caseRoutes = ['/proyectos/payments-platform/', '/en/projects/ticketing-ecosystem/'];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    for (const route of caseRoutes) {
      const where = `${route} @${viewport.width}px flujo`;
      await page.goto(`${origin}${base}${route}`, { waitUntil: 'networkidle' });
      const flow = page.locator('[data-flow]').first();
      if ((await flow.getAttribute('data-enhanced')) === null) {
        errors.push(`${where}: no se activó el modo navegable`);
        continue;
      }
      const tabs = flow.locator('[role="tab"]');
      const n = await tabs.count();
      const panelText = () => flow.locator('[data-flow-panel-text]').innerText();
      const stepText = (i: number) => flow.locator('[data-flow-text]').nth(i).textContent();
      if ((await panelText()) !== (await stepText(0)))
        errors.push(`${where}: la etapa inicial no es la 1`);
      // Teclado: flecha derecha avanza, Fin va a la última, Inicio vuelve a la primera.
      await tabs.nth(0).focus();
      await page.keyboard.press('ArrowRight');
      const focused = await page.evaluate(() =>
        document.activeElement?.getAttribute('aria-selected'),
      );
      if (focused !== 'true' || (await panelText()) !== (await stepText(1)))
        errors.push(`${where}: ArrowRight no selecciona ni enfoca la etapa 2`);
      await page.keyboard.press('End');
      if ((await tabs.nth(n - 1).getAttribute('aria-selected')) !== 'true')
        errors.push(`${where}: Fin no va a la última etapa`);
      if (!(await flow.locator('[data-flow-next]').isDisabled()))
        errors.push(`${where}: "Siguiente" no se deshabilita en la última etapa`);
      await page.keyboard.press('Home');
      // Botones.
      await flow.locator('[data-flow-next]').click();
      if ((await tabs.nth(1).getAttribute('aria-selected')) !== 'true')
        errors.push(`${where}: "Siguiente" no avanza`);
      const done = await flow.locator('[data-flow-step][data-done]').count();
      if (done !== 1) errors.push(`${where}: progreso del conector incorrecto (${done})`);
      // Solo una pestaña en el orden de tabulación.
      const tabbable = await tabs.evaluateAll(
        (els) => els.filter((e) => (e as HTMLElement).tabIndex === 0).length,
      );
      if (tabbable !== 1) errors.push(`${where}: ${tabbable} pestañas tabulables`);
      // El panel no desborda el contenedor.
      const over = await flow.evaluate((el) => el.scrollWidth - el.clientWidth);
      if (over > 0) errors.push(`${where}: desborda ${over}px`);
    }
    await page.close();
  }
  // Sin JS: lista ordenada con todas las etapas y su descripción visibles; panel oculto.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of caseRoutes) {
    await page.goto(`${origin}${base}${route}`, { waitUntil: 'load' });
    const flow = page.locator('[data-flow]').first();
    const steps = await flow.locator('[data-flow-step]').count();
    const visible = await flow
      .locator('[data-flow-text]')
      .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length);
    if (!steps || visible !== steps)
      errors.push(`${route} sin JS: ${visible}/${steps} etapas visibles`);
    if (await flow.locator('[data-flow-panel]').isVisible())
      errors.push(`${route} sin JS: panel visible`);
  }
  await context.close();
}

await browser.close();
server.close();

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error(`✗ Accesibilidad\n\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(
  `✓ Accesibilidad: ${routes.length} páginas × 2 viewports sin violaciones serias · contenido visible sin JS · teclado OK · filtros, flujos, descargas y responsive OK`,
);
