// Tema Mermaid "Midnight Engineering", alineado con los tokens de src/styles/global.css.
// El sitio es oscuro, así que hay un único tema. Los SVG se sirven como <img>, que no puede
// cargar webfonts: se usa una fuente de sistema ancha (Verdana ≈ DejaVu Sans en Linux/CI)
// para que el texto medido en build nunca se recorte.
const fontFamily = 'Verdana, "DejaVu Sans", sans-serif';

export const mermaidDark = {
  theme: 'base',
  fontFamily,
  flowchart: { curve: 'basis', htmlLabels: true, padding: 14 },
  sequence: {
    mirrorActors: false,
    showSequenceNumbers: true,
    width: 120,
    actorMargin: 30,
    boxMargin: 8,
    noteMargin: 8,
    messageMargin: 32,
  },
  themeVariables: {
    fontFamily,
    fontSize: '13px',
    darkMode: true,
    background: '#111826',
    primaryColor: '#14223a',
    primaryBorderColor: '#3b82f6',
    primaryTextColor: '#f5f7fc',
    secondaryColor: '#1b2940',
    secondaryBorderColor: '#5b6b85',
    tertiaryColor: '#0c121d',
    tertiaryBorderColor: '#2a3a55',
    lineColor: '#7d8ba3',
    textColor: '#e3e9f5',
    clusterBkg: '#0c121d',
    clusterBorder: '#2a3a55',
    edgeLabelBackground: '#111826',
    actorBkg: '#14223a',
    actorBorder: '#3b82f6',
    signalColor: '#a5b2c8',
    noteBkgColor: '#1b2940',
    noteBorderColor: '#60a5fa',
    sequenceNumberColor: '#07090f',
    signalTextColor: '#e3e9f5',
    labelBoxBkgColor: '#14223a',
    labelBoxBorderColor: '#3b82f6',
  },
};
