import type { ChartBlock, SchemaBlock } from "./course-types";

export type GraphicsPalette = "screen" | "print";

type RenderOptions = {
  width?: number;
  height?: number;
  palette: GraphicsPalette;
};

const SERIES_COLORS_SCREEN = ["#ffc145", "#ffb000", "#ff8500", "#7fb8b0"];
const SERIES_COLORS_PRINT = ["#111111", "#555555", "#9ca3af", "#111111"];
const SERIES_DASH_PRINT = ["", "6,3", "2,2", "1,3"];

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Charts ─────────────────────────────────────────────────────────────

export function renderChartSvg(block: ChartBlock, opts: RenderOptions): string {
  const width = opts.width ?? 480;
  const height = opts.height ?? 280;
  const isPrint = opts.palette === "print";
  const textColor = isPrint ? "#111111" : "rgba(255,255,255,0.85)";
  const mutedColor = isPrint ? "#9ca3af" : "rgba(255,255,255,0.25)";
  const colors = isPrint ? SERIES_COLORS_PRINT : SERIES_COLORS_SCREEN;

  const padding = { top: block.titre ? 30 : 12, right: 16, bottom: 34, left: 16 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const titreSvg = block.titre
    ? `<text x="${width / 2}" y="16" text-anchor="middle" font-size="13" font-weight="700" fill="${textColor}">${esc(
        block.titre
      )}${block.unite ? ` (${esc(block.unite)})` : ""}</text>`
    : "";

  let marks = "";
  let legend = "";

  if (block.chartType === "pie") {
    const serie = block.series[0];
    const total = serie.valeurs.reduce((a, b) => a + b, 0) || 1;
    const cx = width / 2;
    const cy = padding.top + plotH / 2;
    const r = Math.min(plotW, plotH) / 2 - 4;
    let angleStart = -Math.PI / 2;

    serie.valeurs.forEach((v, i) => {
      const angle = (v / total) * Math.PI * 2;
      const angleEnd = angleStart + angle;
      const x1 = cx + r * Math.cos(angleStart);
      const y1 = cy + r * Math.sin(angleStart);
      const x2 = cx + r * Math.cos(angleEnd);
      const y2 = cy + r * Math.sin(angleEnd);
      const largeArc = angle > Math.PI ? 1 : 0;
      const color = colors[i % colors.length];
      const strokeAttr = isPrint ? ` stroke="#ffffff" stroke-width="1.5"` : "";
      marks += `<path d="M ${cx.toFixed(1)} ${cy.toFixed(1)} L ${x1.toFixed(2)} ${y1.toFixed(
        2
      )} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(
        2
      )} Z" fill="${color}"${strokeAttr} />`;

      const pct = Math.round((v / total) * 100);
      if (pct > 4) {
        const midAngle = angleStart + angle / 2;
        const labelR = r * 0.62;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        marks += `<text x="${lx.toFixed(2)}" y="${ly.toFixed(
          2
        )}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="${
          isPrint ? "#111111" : "#032026"
        }">${pct}%</text>`;
      }
      angleStart = angleEnd;
    });

    legend = `<g font-size="11" fill="${textColor}">${block.categories
      .map((cat, i) => {
        const lx = 4 + Math.floor(i / 2) * (width / 2);
        const ly = height - 6 - (i % 2) * 14;
        return `<rect x="${lx}" y="${ly - 9}" width="9" height="9" fill="${
          colors[i % colors.length]
        }" rx="2" /><text x="${lx + 13}" y="${ly}" dominant-baseline="middle">${esc(cat)}</text>`;
      })
      .join("")}</g>`;
  } else if (block.chartType === "bar") {
    const allValues = block.series.flatMap((s) => s.valeurs);
    const maxVal = Math.max(0, ...allValues);
    const minVal = Math.min(0, ...allValues);
    const range = maxVal - minVal || 1;
    const scaleY = (v: number) => padding.top + plotH - ((v - minVal) / range) * plotH;
    const zeroY = scaleY(0);

    const groupW = plotW / block.categories.length;
    const barW = Math.min(28, (groupW - 10) / block.series.length);

    marks += `<line x1="${padding.left}" y1="${zeroY.toFixed(1)}" x2="${(
      width - padding.right
    ).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="${mutedColor}" stroke-width="1" />`;

    block.categories.forEach((cat, ci) => {
      const groupX = padding.left + ci * groupW;
      block.series.forEach((serie, si) => {
        const v = serie.valeurs[ci];
        const x = groupX + (groupW - barW * block.series.length) / 2 + si * barW;
        const y = Math.min(scaleY(v), zeroY);
        const h = Math.abs(scaleY(v) - zeroY);
        marks += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 3).toFixed(
          1
        )}" height="${h.toFixed(1)}" fill="${colors[si % colors.length]}" rx="2" />`;
        if (isPrint) {
          marks += `<text x="${(x + (barW - 3) / 2).toFixed(1)}" y="${(y - 4).toFixed(
            1
          )}" text-anchor="middle" font-size="9" fill="#111111">${v}</text>`;
        }
      });
      marks += `<text x="${(groupX + groupW / 2).toFixed(1)}" y="${
        height - padding.bottom + 16
      }" text-anchor="middle" font-size="11" fill="${textColor}">${esc(cat)}</text>`;
    });
  } else {
    const allValues = block.series.flatMap((s) => s.valeurs);
    const maxVal = Math.max(0, ...allValues);
    const minVal = Math.min(0, ...allValues);
    const range = maxVal - minVal || 1;
    const scaleY = (v: number) => padding.top + plotH - ((v - minVal) / range) * plotH;
    const zeroY = scaleY(0);
    const stepX = plotW / Math.max(1, block.categories.length - 1);

    marks += `<line x1="${padding.left}" y1="${zeroY.toFixed(1)}" x2="${(
      width - padding.right
    ).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="${mutedColor}" stroke-width="1" />`;

    block.series.forEach((serie, si) => {
      const points = serie.valeurs
        .map((v, i) => `${(padding.left + i * stepX).toFixed(1)},${scaleY(v).toFixed(1)}`)
        .join(" ");
      const color = colors[si % colors.length];
      const dash = isPrint ? SERIES_DASH_PRINT[si % SERIES_DASH_PRINT.length] : "";
      marks += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5"${
        dash ? ` stroke-dasharray="${dash}"` : ""
      } stroke-linejoin="round" />`;
      serie.valeurs.forEach((v, i) => {
        const x = padding.left + i * stepX;
        const y = scaleY(v);
        marks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" />`;
        if (isPrint) {
          marks += `<text x="${x.toFixed(1)}" y="${(y - 8).toFixed(
            1
          )}" text-anchor="middle" font-size="9" fill="#111111">${v}</text>`;
        }
      });
    });

    block.categories.forEach((cat, i) => {
      const x = padding.left + i * stepX;
      marks += `<text x="${x.toFixed(1)}" y="${
        height - padding.bottom + 16
      }" text-anchor="middle" font-size="11" fill="${textColor}">${esc(cat)}</text>`;
    });

    if (block.series.length > 1) {
      legend = `<g font-size="10" fill="${textColor}">${block.series
        .map((s, i) => {
          const lx = padding.left + i * 90;
          return `<rect x="${lx}" y="${height - 8}" width="8" height="8" fill="${
            colors[i % colors.length]
          }" rx="2" /><text x="${lx + 12}" y="${height - 1}">${esc(s.nom)}</text>`;
        })
        .join("")}</g>`;
    }
  }

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(
    block.titre ?? "Graphique"
  )}">${titreSvg}${marks}${legend}</svg>`;
}

// ─── Schemas ────────────────────────────────────────────────────────────

export function renderSchemaSvg(block: SchemaBlock, opts: RenderOptions): string {
  const width = opts.width ?? 560;
  const height = opts.height ?? 300;
  const isPrint = opts.palette === "print";
  const ink = isPrint ? "#111111" : "#ffffff";
  const muted = isPrint ? "#555555" : "rgba(255,255,255,0.7)";
  const line = isPrint ? "#9ca3af" : "rgba(255,255,255,0.35)";
  const accent = isPrint ? "#111111" : "#ffc145";
  const accentText = isPrint ? "#111111" : "#032026";

  const titreSvg = block.titre
    ? `<text x="${width / 2}" y="18" text-anchor="middle" font-size="13" font-weight="700" fill="${ink}">${esc(
        block.titre
      )}</text>`
    : "";
  const topOffset = block.titre ? 34 : 8;

  if (block.variant === "comparaison") {
    const colW = 100 / block.colonnes.length;
    const cols = block.colonnes
      .map(
        (col) => `
        <div style="flex:1;min-width:0;padding:0 12px;${
          isPrint ? "border-left:1px solid #d1d5db;" : "border-left:1px solid rgba(255,255,255,0.15);"
        }">
          <p style="margin:0 0 8px;font-weight:700;font-size:13px;color:${ink};">${esc(col.titre)}</p>
          <ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.6;color:${muted};">
            ${col.points.map((p) => `<li>${esc(p)}</li>`).join("")}
          </ul>
        </div>`
      )
      .join("");
    return `<div style="width:100%;max-width:${width}px;margin:0 auto;">
      ${
        block.titre
          ? `<p style="text-align:center;font-weight:700;font-size:13px;margin:0 0 12px;color:${ink};">${esc(
              block.titre
            )}</p>`
          : ""
      }
      <div style="display:flex;gap:0;">${cols}</div>
    </div>`;
  }

  if (block.variant === "frise") {
    const n = block.evenements.length;
    const marginX = 40;
    const y = topOffset + (height - topOffset) / 2;
    const stepX = (width - marginX * 2) / Math.max(1, n - 1);
    let marks = `<line x1="${marginX}" y1="${y}" x2="${width - marginX}" y2="${y}" stroke="${line}" stroke-width="2" />`;
    block.evenements.forEach((ev, i) => {
      const x = marginX + i * stepX;
      const above = i % 2 === 0;
      const labelY = above ? y - 16 : y + 28;
      const dateY = above ? y - 32 : y + 44;
      marks += `<circle cx="${x.toFixed(1)}" cy="${y}" r="5" fill="${accent}" />`;
      marks += `<line x1="${x.toFixed(1)}" y1="${y}" x2="${x.toFixed(1)}" y2="${above ? y - 12 : y + 12}" stroke="${line}" stroke-width="1.5" />`;
      marks += `<text x="${x.toFixed(1)}" y="${dateY}" text-anchor="middle" font-size="10" font-weight="700" fill="${accentText === "#032026" ? accent : accentText}">${esc(ev.date)}</text>`;
      marks += `<text x="${x.toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="11" fill="${ink}">${esc(ev.label)}</text>`;
    });
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Frise chronologique">${titreSvg}${marks}</svg>`;
  }

  if (block.variant === "cycle") {
    const n = block.etapes.length;
    const cx = width / 2;
    const cy = topOffset + (height - topOffset) / 2 + 4;
    const r = Math.min(width, height - topOffset) / 2 - 46;
    const nodeR = 20;
    let marks = "";
    const points = block.etapes.map((_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const mx = (a.x + b.x) / 2 + (cy - (a.y + b.y) / 2) * 0.15;
      const my = (a.y + b.y) / 2 + ((a.x + b.x) / 2 - cx) * 0.15;
      marks += `<path d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(
        1
      )} ${b.x.toFixed(1)} ${b.y.toFixed(1)}" fill="none" stroke="${line}" stroke-width="2" marker-end="url(#cycleArrow)" />`;
    }
    block.etapes.forEach((etape, i) => {
      const p = points[i];
      marks += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${nodeR}" fill="${accent}" />`;
      marks += `<text x="${p.x.toFixed(1)}" y="${p.y.toFixed(
        1
      )}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="#032026">${
        i + 1
      }</text>`;
      const labelAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const labelR = r + nodeR + 14;
      const lx = cx + labelR * Math.cos(labelAngle);
      const ly = cy + labelR * Math.sin(labelAngle);
      marks += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(
        1
      )}" text-anchor="middle" font-size="11" fill="${ink}">${esc(etape.label)}</text>`;
    });
    const defs = `<defs><marker id="cycleArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${line}" /></marker></defs>`;
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma cyclique">${defs}${titreSvg}${marks}</svg>`;
  }

  if (block.variant === "etapes") {
    const n = block.etapes.length;
    const marginX = 20;
    const gap = 24;
    const boxW = (width - marginX * 2 - gap * (n - 1)) / n;
    const boxH = 56;
    const y = topOffset + (height - topOffset - boxH) / 2;
    let marks = "";
    block.etapes.forEach((etape, i) => {
      const x = marginX + i * (boxW + gap);
      marks += `<rect x="${x.toFixed(1)}" y="${y}" width="${boxW.toFixed(
        1
      )}" height="${boxH}" rx="8" fill="none" stroke="${accent}" stroke-width="2" />`;
      marks += `<text x="${(x + boxW / 2).toFixed(1)}" y="${y + 22}" text-anchor="middle" font-size="11" font-weight="700" fill="${
        isPrint ? "#111111" : "#ffc145"
      }">${i + 1}</text>`;
      marks += `<text x="${(x + boxW / 2).toFixed(1)}" y="${y + 40}" text-anchor="middle" font-size="11" fill="${ink}">${esc(
        etape.label
      )}</text>`;
      if (i < n - 1) {
        const arrowX1 = x + boxW;
        const arrowX2 = arrowX1 + gap;
        const arrowY = y + boxH / 2;
        marks += `<line x1="${arrowX1.toFixed(1)}" y1="${arrowY}" x2="${(arrowX2 - 6).toFixed(
          1
        )}" y2="${arrowY}" stroke="${line}" stroke-width="2" marker-end="url(#etapesArrow)" />`;
      }
    });
    const defs = `<defs><marker id="etapesArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${line}" /></marker></defs>`;
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Étapes">${defs}${titreSvg}${marks}</svg>`;
  }

  // legende
  const boxX = 8;
  const boxY = topOffset;
  const boxW = width * 0.58 - 16;
  const boxH = height - topOffset - 8;
  const imageEl = block.image
    ? `<image href="${esc(block.image.src)}" x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" preserveAspectRatio="xMidYMid slice" />`
    : `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" fill="none" stroke="${line}" stroke-width="1.5" stroke-dasharray="4,4" rx="8" />`;
  let pins = "";
  block.points.forEach((pt) => {
    const px = boxX + (pt.x / 100) * boxW;
    const py = boxY + (pt.y / 100) * boxH;
    pins += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="11" fill="${accent}" stroke="${
      isPrint ? "#ffffff" : "#032026"
    }" stroke-width="1.5" />`;
    pins += `<text x="${px.toFixed(1)}" y="${py.toFixed(
      1
    )}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="#032026">${
      pt.numero
    }</text>`;
  });
  const legendItems = block.points
    .map(
      (pt, i) =>
        `<text x="${width * 0.6}" y="${boxY + 16 + i * 18}" font-size="11" fill="${ink}"><tspan font-weight="700" fill="${
          isPrint ? "#111111" : "#ffc145"
        }">${pt.numero}.</tspan> ${esc(pt.label)}</text>`
    )
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Figure légendée">${titreSvg}${imageEl}${pins}${legendItems}</svg>`;
}
