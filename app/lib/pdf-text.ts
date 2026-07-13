export type ExtractionPdf = {
  texte: string;
  tronque: boolean;
};

const MAX_CARACTERES_PAR_DEFAUT = 15000;

/**
 * Extrait le texte d'un PDF (fourni en data URL) entièrement côté client via pdf.js.
 * Retourne une chaîne vide si le PDF n'a pas de calque texte (scan/image) —
 * l'appelant doit traiter ce cas comme un échec d'extraction, pas une erreur.
 */
export async function extraireTextePdf(
  dataUrl: string,
  maxCaracteres = MAX_CARACTERES_PAR_DEFAUT
): Promise<ExtractionPdf> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const reponse = await fetch(dataUrl);
  const buffer = await reponse.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let texte = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const contenu = await page.getTextContent();
    const ligne = contenu.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    texte += `${ligne}\n\n`;
    if (texte.length >= maxCaracteres) break;
  }

  const tronque = texte.length > maxCaracteres;
  return { texte: texte.slice(0, maxCaracteres).trim(), tronque };
}
