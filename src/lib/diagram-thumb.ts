/**
 * Miniatura del primer diagrama Mermaid de un caso de estudio, renderizada en build para
 * las tarjetas destacadas (tema oscuro único). Sin JS en el cliente.
 */
import { createMermaidRenderer, type RenderOptions } from 'mermaid-isomorphic';
import { mermaidDark } from './mermaid-theme.mjs';

type MermaidConfig = NonNullable<RenderOptions['mermaidConfig']>;

export interface DiagramThumb {
  src: string;
  width: number;
  height: number;
}

const render = createMermaidRenderer();
const cache = new Map<string, Promise<DiagramThumb | null>>();
const toDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

async function build(code: string, prefix: string): Promise<DiagramThumb | null> {
  const [result] = await render([code], { mermaidConfig: mermaidDark as MermaidConfig, prefix });
  if (result?.status !== 'fulfilled') return null;
  return {
    src: toDataUri(result.value.svg),
    width: Math.round(result.value.width),
    height: Math.round(result.value.height),
  };
}

export function diagramThumb(
  body: string | undefined,
  prefix: string,
): Promise<DiagramThumb | null> {
  const code = body?.match(/```mermaid\n([\s\S]*?)```/)?.[1];
  if (!code) return Promise.resolve(null);
  const key = `${prefix}:${code}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = build(code, prefix);
    cache.set(key, hit);
  }
  return hit;
}
