// Envuelve cada diagrama Mermaid (<img> generado en build) en <figure class="diagram">:
// - expone su ancho natural como variable CSS --w (escalado en móvil, ver global.css);
// - usa accTitle (atributo title) como <figcaption> visible; accDescr ya es el alt.
import { visit } from 'unist-util-visit';

export default function rehypeDiagramWidth() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'img' || !String(node.properties?.id ?? '').startsWith('mermaid-'))
        return;
      if (!parent || index === undefined || parent.tagName === 'figure') return;
      const width = Number.parseFloat(node.properties.width);
      const title = node.properties.title;
      node.properties.loading = 'lazy';
      node.properties.decoding = 'async';
      const figure = {
        type: 'element',
        tagName: 'figure',
        properties: {
          className: ['diagram'],
          'data-reveal': '',
          // Puede tener scroll horizontal en móvil: debe ser alcanzable con teclado.
          tabIndex: 0,
          style: Number.isFinite(width) ? `--w:${Math.round(width)}px` : undefined,
        },
        children: [
          node,
          ...(title
            ? [
                {
                  type: 'element',
                  tagName: 'figcaption',
                  properties: {},
                  children: [{ type: 'text', value: String(title) }],
                },
              ]
            : []),
        ],
      };
      delete node.properties.title;
      parent.children[index] = figure;
    });
  };
}
