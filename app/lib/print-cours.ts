import { escapeHtml, ouvrirEtImprimer, printBaseStyles, printDocumentHeader } from "./print-document";
import { renderChartSvg, renderSchemaSvg } from "./course-graphics";
import type { CoursPresentation, Slide, SlideBlock } from "./course-types";

function renderBlockHtml(block: SlideBlock, e: (s: string) => string): string {
  switch (block.type) {
    case "text": {
      if (block.style === "paragraph") {
        return block.lignes.map((ligne) => `<p>${e(ligne)}</p>`).join("");
      }
      return `<ul>${block.lignes.map((ligne) => `<li>${e(ligne)}</li>`).join("")}</ul>`;
    }
    case "chart":
      return `<div class="course-graphic">${renderChartSvg(block, {
        palette: "print",
        width: 480,
        height: 260
      })}</div>`;
    case "schema":
      return `<div class="course-graphic">${renderSchemaSvg(block, {
        palette: "print",
        width: 520,
        height: 260
      })}</div>`;
    case "media": {
      const legende = block.media.legende ? `<p class="meta">${e(block.media.legende)}</p>` : "";
      if (block.media.type === "image") {
        return `<div class="course-graphic"><img src="${e(
          block.media.src
        )}" alt="${e(block.media.legende ?? "")}" style="max-width:100%;max-height:280px;" />${legende}</div>`;
      }
      return `<p class="meta">Vidéo : https://www.youtube.com/watch?v=${e(block.media.src)}</p>${legende}`;
    }
    default:
      return "";
  }
}

function renderSlideHtml(slide: Slide, index: number, e: (s: string) => string): string {
  const blocksHtml = slide.blocks.map((bloc) => renderBlockHtml(bloc, e)).join("");
  const notes = slide.notes_enseignant
    ? `<div class="section"><h3>Notes enseignant</h3><p>${e(slide.notes_enseignant)}</p></div>`
    : "";
  return `
    <section class="phase">
      <h2>Diapositive ${index + 1} — ${e(slide.titre)}</h2>
      ${blocksHtml}
      ${slide.interaction ? `<p class="meta">Interaction : ${e(slide.interaction)}</p>` : ""}
      ${notes}
    </section>`;
}

export function imprimerCours(course: CoursPresentation): void {
  const e = escapeHtml;
  const slidesHtml = course.slides.map((slide, i) => renderSlideHtml(slide, i, e)).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${e(course.titre)}</title>
  <style>${printBaseStyles()}
    .course-graphic { margin: 8pt 0; text-align: center; }
  </style>
</head>
<body>
  ${printDocumentHeader()}
  <div class="intro">
    <p class="label">Cours</p>
    <h1>${e(course.titre)}</h1>
    <p class="subtitle">${[course.niveau].filter(Boolean).map(e).join(" · ")}</p>
    ${course.objectif ? `<h3>Objectif</h3><p>${e(course.objectif)}</p>` : ""}
    ${course.materiel?.length ? `<h3>Matériel</h3><p>${course.materiel.map(e).join(", ")}</p>` : ""}
  </div>
  ${slidesHtml}
</body>
</html>`;

  ouvrirEtImprimer(html);
}
