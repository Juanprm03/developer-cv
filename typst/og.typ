// Imagen Open Graph (1200×630) con la identidad Midnight Engineering.
// Lee el CV resuelto de la variante por defecto (ver scripts/build-pdf.ts).
#let cv = json(sys.inputs.at("data", default: "/.cache/cv/general.es.json"))
#let b = cv.basics

#let bg = rgb("#07090f")
#let accent = rgb("#3b82f6")
#let text-1 = rgb("#f5f7fc")
#let text-2 = rgb("#a5b2c8")

#set page(width: 1200pt, height: 630pt, margin: 80pt, fill: bg)
#set text(font: "Inter", fill: text-1)

// Glow ambiental discreto y línea de acento.
#place(top + right, dx: 260pt, dy: -320pt, circle(
  radius: 420pt,
  fill: gradient.radial(accent.transparentize(78%), bg.transparentize(100%)),
))
#place(top + left, dx: -80pt, dy: -80pt, rect(width: 1200pt, height: 6pt, fill: accent))

#align(horizon)[
  #text(size: 22pt, weight: "semibold", fill: accent, tracking: 0.18em, upper(cv.home.kicker))
  #v(18pt)
  #text(size: 72pt, weight: "bold", tracking: -0.02em, b.name)
  #v(26pt)
  #set text(size: 26pt, fill: text-2)
  #cv.competencies.slice(0, calc.min(2, cv.competencies.len())).join("  ·  ")
]

#place(bottom + left, text(size: 22pt, fill: text-2)[
  #b.location.city, #b.location.country #h(1fr) #b.url.replace(regex("^https?://"), "").trim("/", at: end)
])
