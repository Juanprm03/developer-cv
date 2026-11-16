// CV — plantilla "Executive Tech Minimal".
// Lee el CV YA RESUELTO (JSON) que genera scripts/build-pdf.ts desde data/profile.yaml y la
// variante (validado con Zod). Uso:
//   typst compile --root . --font-path typst/fonts --input data=/.cache/cv/general.es.json typst/cv.typ out.pdf
//
// Reglas ATS: una columna, texto real y seleccionable, encabezados estándar, fuentes embebidas,
// sin iconos, barras ni tablas de maquetación; enlaces como anotaciones con la URL visible.

#let cv = json(sys.inputs.at("data", default: "/.cache/cv/general.es.json"))
#let lang = cv.meta.lang
#let labels = cv.meta.labels
#let b = cv.basics

// ── Tokens (sobrios: texto oscuro y un azul discreto como único acento) ────
#let ink = rgb("#111827")
#let body-ink = rgb("#1f2937")
#let muted = rgb("#4b5563")
#let accent = rgb("#1e3a8a") // azul profundo: 10.4:1 sobre blanco
#let rule-color = rgb("#d9dee7")

// ── Utilidades ────────────────────────────────────────────────────────────
/// `texto con **negrita**` → content.
#let rich(s) = (
  s
    .split("**")
    .enumerate()
    .map(((i, part)) => if calc.odd(i) { strong(part) } else { part })
    .join()
)

#let fmt-date(d) = {
  let parts = str(d).split("-")
  if parts.len() == 2 { labels.months.at(int(parts.at(1)) - 1) + " " + parts.at(0) } else { parts.at(0) }
}
#let fmt-range(start, end) = fmt-date(start) + " – " + if end == none { labels.present } else { fmt-date(end) }
#let pretty-url(u) = u.replace(regex("^https?://(www\.)?"), "").trim("/", at: end)
#let dot = h(0.45em) + text(fill: rule-color, "•") + h(0.45em)

// Fecha del documento = última revisión del contenido: PDF reproducible entre builds.
#let revision = str(cv.meta.lastModified).split("-")

// ── Documento ─────────────────────────────────────────────────────────────
#set document(
  title: cv.meta.title,
  author: b.name,
  description: cv.meta.description,
  keywords: cv.competencies,
  date: datetime(
    year: int(revision.at(0)),
    month: if revision.len() > 1 { int(revision.at(1)) } else { 1 },
    day: 1,
  ),
)

#set page(
  paper: "a4",
  margin: (x: 1.9cm, top: 1.55cm, bottom: 1.45cm),
  footer: context text(size: 7.5pt, fill: muted)[
    #b.name #h(1fr) #counter(page).display("1 / 1", both: true)
  ],
)

#set text(font: "Inter", size: 10pt, fill: body-ink, lang: lang, hyphenate: false)
#set par(justify: false, leading: 0.7em, spacing: 0.95em)
#set list(indent: 0.1em, body-indent: 0.55em, spacing: 0.62em, marker: text(fill: accent, size: 0.8em, baseline: -0.05em)[■])
#set strong(delta: 200)
#show link: it => it
// Palabras con guion no se parten (evita "AI-" / "-native" en lectores ATS).
#show regex("[\p{L}\d]+(-[\p{L}\d]+)+"): box

// Encabezado de sección: mayúsculas sin espaciado entre letras (los ATS lo extraen como
// "P E R F I L"), oscuro, con separador sutil.
#show heading.where(level: 1): it => {
  v(1.3em, weak: true)
  block(below: 0.85em, width: 100%)[
    #text(size: 9.5pt, weight: "bold", fill: ink, upper(it.body))
    #v(-0.55em)
    #line(length: 100%, stroke: 0.6pt + rule-color)
  ]
}

// ── 1. Encabezado ─────────────────────────────────────────────────────────
#block(below: 0.4em)[
  #text(size: 23pt, weight: "bold", fill: ink, tracking: -0.015em, b.name)
  #v(-0.15em)
  #text(size: 11.5pt, weight: "medium", fill: accent, b.label)
]
#{
  set text(size: 8.7pt, fill: muted)
  let loc = b.location.city + ", " + b.location.country
  let items = (loc,)
  if "phone" in b { items.push(link("tel:" + b.phone.replace(" ", ""), b.phone)) }
  items.push(link("mailto:" + b.email, b.email))
  for p in b.profiles { items.push(link(p.url, pretty-url(p.url))) }
  if "url" in b { items.push(link(b.url, pretty-url(b.url))) }
  // box(): cada dato de contacto se mantiene en una sola línea.
  items.map(box).join(dot)
}

// ── 2. Perfil ─────────────────────────────────────────────────────────────
= #labels.summary
#par(leading: 0.68em, rich(b.summary.trim()))

// ── 3. Habilidades técnicas ───────────────────────────────────────────────
= #labels.skills
#grid(
  columns: (3.9cm, 1fr),
  column-gutter: 0.9em,
  row-gutter: 0.62em,
  ..cv.skills.map(s => (
    text(weight: "semibold", fill: ink, s.name),
    (s.at("featured", default: ()).map(k => text(weight: "semibold", k)) + s.at("keywords", default: ()).map(k => [#k])).join(", "),
  )).flatten()
)

// ── 4. Experiencia ────────────────────────────────────────────────────────
= #labels.work
#for job in cv.work [
  #block(breakable: true, below: 1.35em)[
    #grid(
      columns: (1fr, auto),
      column-gutter: 1em,
      text(size: 10.5pt, weight: "bold", fill: ink, job.position),
      text(size: 8.8pt, fill: muted, fmt-range(job.startDate, job.at("endDate", default: none))),
    )
    #v(-0.35em)
    #text(weight: "medium", fill: accent)[
      #if "url" in job { link(job.url, job.name) } else { job.name }#if "location" in job [ · #job.location]
    ]
    #if "summary" in job { block(above: 0.55em, text(fill: muted, rich(job.summary))) }
    #if job.at("highlights", default: ()).len() > 0 { list(..job.highlights.map(rich)) }
    // Cada grupo se mantiene entero en una página: el subtítulo nunca queda separado de sus
    // viñetas ni hay viñetas sin encabezado al inicio de la página siguiente.
    #for g in job.at("groups", default: ()) [
      #block(above: 1em, breakable: false)[
        #block(below: 0.5em, text(size: 9.2pt, weight: "semibold", fill: accent, g.name))
        #list(..g.highlights.map(rich))
      ]
    ]
    #if job.at("technologies", default: ()).len() > 0 {
      block(above: 0.55em, text(size: 8.6pt, fill: muted)[#labels.technologies: #job.technologies.join(", ")])
    }
  ]
]

// ── 5. Proyectos seleccionados ────────────────────────────────────────────
#if cv.at("projects", default: ()).len() > 0 [
  = #labels.projects
  #for p in cv.projects [
    #block(below: 1em, breakable: false)[
      #text(weight: "bold", fill: ink, p.name)
      #{
        let tags = ()
        let named = lower(p.name).contains(lower(labels.personalProject))
        if p.at("context", default: "professional") == "personal" and not named { tags.push(labels.personalProject) }
        if p.at("status", default: none) == "development" { tags.push(labels.inDevelopment) }
        if p.at("status", default: none) == "stopped" { tags.push(labels.devStopped) }
        if tags.len() > 0 { text(size: 8.6pt, fill: muted)[ · #tags.join(" · ")] }
      }
      #if "url" in p { linebreak(); text(size: 8.6pt, fill: accent, link(p.url, pretty-url(p.url))) }
      #block(above: 0.45em, rich(p.description))
      #if p.at("highlights", default: ()).len() > 0 { list(..p.highlights.map(rich)) }
      #if p.at("technologies", default: ()).len() > 0 {
        block(above: 0.45em, text(size: 8.6pt, fill: muted)[#labels.technologies: #p.technologies.join(", ")])
      }
    ]
  ]
]

// ── 6. Formación académica ────────────────────────────────────────────────
= #labels.education
#for e in cv.education [
  #grid(
    columns: (1fr, auto),
    column-gutter: 1em,
    text(weight: "bold", fill: ink)[#e.studyType #labels.degreeIn #e.area],
    text(size: 8.8pt, fill: muted, if "startDate" in e { fmt-date(e.startDate) + " – " + fmt-date(e.endDate) } else { fmt-date(e.endDate) }),
  )
  #v(-0.35em)
  #text(fill: accent, weight: "medium", e.institution)
]

// ── 7. Cursos y conocimientos complementarios ─────────────────────────────
#let certs = cv.at("certificates", default: ())
#let know = cv.at("knowledge", default: ())
#if certs.len() + know.len() > 0 [
  = #labels.coursesKnowledge
  #if certs.len() > 0 {
    let issuers = certs.map(c => c.at("issuer", default: none)).dedup()
    let names = certs.map(c => c.name).join(", ")
    par[*#labels.courses#if issuers.len() == 1 and issuers.first() != none [ (#issuers.first())]:* #names]
  }
  #for (ctx, label) in (("personal", labels.knowledgePersonal), ("learning", labels.knowledgeLearning)) {
    let items = know.filter(k => k.context == ctx).map(k => k.name)
    if items.len() > 0 { par[*#label:* #items.join(", ")] }
  }
  #if know.len() > 0 { text(size: 8.6pt, fill: muted, style: "italic", labels.knowledgeNote) }
]

// ── 8. Idiomas ────────────────────────────────────────────────────────────
= #labels.languages
#cv.languages.map(l => [*#l.language:* #l.fluency]).join(dot)

// ── 9. Referencias ────────────────────────────────────────────────────────
// Los datos llegan solo al JSON del PDF (scripts/build-pdf.ts, src/lib/references.ts); sin
// referencias configuradas se muestra la nota "disponibles a solicitud".
#if cv.meta.at("referencesNote", default: false) [
  = #labels.references
  #let refs = cv.at("references", default: ())
  #if refs.len() == 0 { labels.referencesNote }
  #for r in refs [
    #block(below: 0.7em)[
      #text(weight: "bold", fill: ink, r.name) — #r.position, #r.company \
      #text(size: 9pt, fill: muted)[#box(link(r.tel, r.phone))#dot#box(link("mailto:" + r.email, r.email))]
    ]
  ]
]

// Metadato para que scripts/build-pdf.ts verifique el nº de páginas.
#context [#metadata(counter(page).final().first()) <page-count>]
