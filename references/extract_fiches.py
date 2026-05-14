"""
Extraction des Fiches thématiques pédagogiques → fiches.json
Usage : python extract_fiches.py [--dossier fiches_raw] [--sortie fiches.json]
"""

import fitz, re, json, glob, os, argparse
from collections import defaultdict

# ── Décodage noms de fichiers Windows ──────────────────────────────────────────
def decode(s):
    return re.sub(r"#U([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)

# ── Parsing nom de fichier → métadonnées ───────────────────────────────────────
def parse_filename(path):
    folder = decode(os.path.dirname(path).split(os.sep)[-1])
    name   = decode(os.path.basename(path)).replace(".pdf", "")

    # Matière depuis le dossier parent (remonte si sous-dossier Maths)
    parts = [decode(p) for p in path.replace("\\", "/").split("/")]
    matiere = "Inconnu"
    for p in parts:
        if p in ("Géographie", "Histoire", "Mathématiques", "Sciences",
                 "Syntaxe", "Vocabulaire", "Étude de la langue"):
            matiere = p
            break

    # Niveau (5ème, 6ème, CM1, Cycle 3…)
    niveau = ""
    m = re.match(r"^(\d+[eè]me|CM\d|CE\d|CP|Cycle\s*\d)", name, re.I)
    if m:
        niveau = m.group(1)

    # Thème
    theme = ""
    m2 = re.search(r"Th[eè]me\s+\d+\s*[-–]\s*(.+)", name)
    if m2:
        theme = m2.group(1).strip()

    return {
        "matiere" : matiere,
        "sous_dossier": folder,
        "niveau"  : niveau,
        "theme"   : theme,
        "titre"   : name,
    }

# ── Nettoyage texte ────────────────────────────────────────────────────────────
def clean(text):
    # Supprime en-têtes Éduscol répétitifs
    text = re.sub(r"eduscol\.education\.fr[^\n]*\n", "", text)
    text = re.sub(r"Retrouvez Éduscol[^\n]*\n", "", text)
    text = re.sub(r"CYCLE\s+[I\s]+[^\n]+\n", "", text)
    # Puces PDF
    text = re.sub(r"[\uf0b7\uf0a7\u2022\u25cf\u25aa\x07]", "• ", text)
    # Numéros de page isolés
    text = re.sub(r"^\s*\d{1,2}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r" +", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# ── Détection des sections dans une page ──────────────────────────────────────
SECTION_PATTERNS = [
    r"Pourquoi enseigner",
    r"Quelle est la place du thème",
    r"Comment mettre en [œo]uvre",
    r"Quels sont les [ée]cueils",
    r"Sous-thème\s+\d+",
    r"Ce qui est attendu",
    r"Connaissances et procédures",
    r"Progressivit[ée]",
    r"Objectif[s]?\s*:",
    r"Compétence[s]?\s*:",
    r"Activité[s]?",
    r"Situation\s+\d+",
    r"Le professeur",
    r"Points de vigilance",
]

def detect_section(line):
    for pat in SECTION_PATTERNS:
        if re.search(pat, line, re.I):
            return line
    return None

# ── Chunking par page (stratégie principale) ──────────────────────────────────
def chunk_document(path, meta):
    doc = fitz.open(path)
    chunks = []

    # Cas annexes/fiches vides (< 200 chars de texte total)
    full_text = "".join(p.get_text() for p in doc)
    if len(full_text.strip()) < 200:
        return []  # pas de texte exploitable (figures géométriques, etc.)

    for page_num, page in enumerate(doc, 1):
        raw = page.get_text()
        text = clean(raw)
        if len(text) < 80:
            continue

        # Découpe la page en blocs par section si possible
        lines = text.split("\n")
        current_section = ""
        current_lines   = []

        def flush_block(section, lines, page_num):
            content = "\n".join(lines).strip()
            if len(content) < 40:
                return None
            return {
                **meta,
                "page"    : page_num,
                "section" : section,
                "contenu" : content,
                "texte_complet": "\n".join(filter(None, [
                    f"{meta['matiere']} — {meta['titre']}",
                    f"Niveau : {meta['niveau']}" if meta['niveau'] else "",
                    f"Thème : {meta['theme']}"   if meta['theme']  else "",
                    f"Section : {section}"        if section        else "",
                    content,
                ])),
            }

        for line in lines:
            sec = detect_section(line)
            if sec and current_lines:
                block = flush_block(current_section, current_lines, page_num)
                if block:
                    chunks.append(block)
                current_section = sec
                current_lines   = []
            else:
                current_lines.append(line)

        block = flush_block(current_section, current_lines, page_num)
        if block:
            chunks.append(block)

    # Si trop peu de chunks (structure non détectée) → un chunk par page
    if len(chunks) < 2 and len(full_text) > 500:
        chunks = []
        for page_num, page in enumerate(doc, 1):
            text = clean(page.get_text())
            if len(text) < 80:
                continue
            chunks.append({
                **meta,
                "page"    : page_num,
                "section" : f"page {page_num}",
                "contenu" : text,
                "texte_complet": f"{meta['matiere']} — {meta['titre']}\n{text}",
            })

    return chunks

# ── Pipeline principal ─────────────────────────────────────────────────────────
def process_all(root):
    files = sorted(glob.glob(os.path.join(root, "**", "*.pdf"), recursive=True))
    if not files:
        print(f"Aucun PDF dans '{root}'"); return []

    all_chunks = []
    skipped    = []

    for path in files:
        meta   = parse_filename(path)
        chunks = chunk_document(path, meta)

        if not chunks:
            skipped.append(decode(os.path.basename(path)))
            continue

        label = f"{meta['matiere']:20s} | {meta['niveau']:6s} | {decode(os.path.basename(path))[:45]}"
        print(f"  {label}  →  {len(chunks)} chunks")
        all_chunks.extend(chunks)

    if skipped:
        print(f"\n  Ignorés (pas de texte extractible) : {len(skipped)}")
        for s in skipped:
            print(f"    - {s}")

    return all_chunks

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dossier", default="fiches_raw")
    parser.add_argument("--sortie",  default="fiches.json")
    args = parser.parse_args()

    print(f"=== Extraction — {args.dossier} ===\n")
    chunks = process_all(args.dossier)
    if not chunks:
        exit(1)

    with open(args.sortie, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {len(chunks)} chunks  →  '{args.sortie}'")

    # Aperçu
    sample = next((c for c in chunks if len(c["contenu"]) > 200), chunks[0])
    print("\n── Exemple de chunk ──")
    print(json.dumps({k: v for k, v in sample.items() if k != "texte_complet"},
                     ensure_ascii=False, indent=2)[:600])

    # Stats par matière
    from collections import Counter
    stats = Counter(c["matiere"] for c in chunks)
    print("\n── Répartition par matière ──")
    for k, v in sorted(stats.items()):
        print(f"  {k:30s}  {v:4d} chunks")
