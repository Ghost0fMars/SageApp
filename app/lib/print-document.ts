export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function printBaseStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #111; padding: 1.8cm 2.5cm 2cm; }
    h1 { font-size: 20pt; font-weight: bold; margin-bottom: 5pt; }
    h2 { font-size: 13pt; font-weight: bold; margin: 18pt 0 4pt; border-bottom: 1px solid #d1d5db; padding-bottom: 3pt; }
    h3 { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .07em; margin: 10pt 0 2pt; color: #555; }
    p { margin-bottom: 6pt; white-space: pre-wrap; }
    ul { margin: 4pt 0 6pt 1.4em; }
    li { margin-bottom: 2pt; }
    .label { font-size: 8pt; font-weight: bold; letter-spacing: .18em; text-transform: uppercase; color: #9ca3af; margin-bottom: 6pt; }
    .subtitle { font-size: 10pt; color: #6b7280; margin-bottom: 12pt; }
    .meta { font-size: 9pt; color: #6b7280; margin-bottom: 6pt; font-style: italic; }
    .intro { margin-bottom: 18pt; padding-bottom: 14pt; border-bottom: 2px solid #111; }
    .phase { margin-top: 14pt; break-inside: avoid; }
    .section { margin-top: 14pt; break-inside: avoid; }
    .doc-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 7pt; margin-bottom: 18pt; border-bottom: 1px solid #e5e7eb; }
    .doc-brand { font-size: 8pt; font-weight: bold; letter-spacing: .25em; text-transform: uppercase; color: #d1d5db; }
    .doc-date { font-size: 8pt; color: #9ca3af; }
    @page {
      size: A4;
      margin: 2cm 2.5cm 2.5cm;
      @bottom-center { content: "— " counter(page) " —"; font-family: Georgia, serif; font-size: 8pt; color: #9ca3af; }
      @bottom-right { content: "SAGE"; font-family: Georgia, serif; font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: #d1d5db; }
    }
    @media print { body { padding: 0; } }
  `;
}

export function printDocumentHeader(): string {
  const date = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  return `
    <div class="doc-header">
      <span class="doc-brand">SAGE</span>
      <span class="doc-date">${date}</span>
    </div>`;
}

export function ouvrirEtImprimer(html: string): void {
  const fenetre = window.open("", "_blank", "width=900,height=700");
  if (!fenetre) return;
  fenetre.document.write(html);
  fenetre.document.close();
  fenetre.focus();
  fenetre.print();
}
