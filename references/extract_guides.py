"""
Extraction des Guides pédagogiques fondamentaux → guides.json
Chunking basé sur la typographie (taille + gras) pour détecter les sections.

Usage : python extract_guides.py [--dossier guides_raw/Guides] [--sortie guides.json]
"""

import fitz, re, json, glob, os, argparse
from collections import defaultdict

# ── Décodage noms Windows ──────────────────────────────────────────────────────
def decode(s):
    return re.sub(r"#U([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)

# ── Parsing nom de fichier ─────────────────────────────────────────────────────
def parse_filename(path):
    name = decode(os.path.basename(path)).replace(".pdf", "")
    cycle, titre, matiere, niveau = "", name, "Général", ""

    m = re.match(r"(Cycle\s*\d+)\s*[-–]\s*(.+)", name, re.I)
    if m:
        cycle  = m.group(1).strip()
        titre  = m.group(2).strip()

    # Matière
    if re.search(r"nombre|calcul|math|num[eé]ration|proportionnalit[eé]|g[eé]om[eé]trie|probl[eè]me", titre, re.I):
        matiere = "Mathématiques"
    elif re.search(r"lecture|[eé]criture|vocabulaire|langage|syntaxe|oral|phonolog", titre, re.I):
        matiere = "Français"
    elif re.search(r"perturbat|comportement|climat|[eé]l[eè]ve", titre, re.I):
        matiere = "Gestion de classe"
    elif re.search(r"compréhension", titre, re.I):
        matiere = "Français"

    # Niveau depuis cycle
    niveau_map = {"Cycle 1": "Maternelle", "Cycle 2": "CP-CE1-CE2",
                  "Cycle 3": "CM1-CM2-6ème", "Cycle 4": "Collège"}
    niveau = niveau_map.get(cycle, "")

    # Niveau plus précis si mentionné dans le titre
    for lvl in ["CP", "CE1", "CE2", "CM1", "CM2", "6ème", "collège", "maternelle"]:
        if re.search(lvl, titre, re.I):
            niveau = lvl.capitalize()
            break

    return {"cycle": cycle, "titre": titre, "matiere": matiere, "niveau": niveau}

# ── Nettoyage texte ────────────────────────────────────────────────────────────
def clean(text):
    text = text.replace("\xa0", " ").replace("\x07", "").replace("\uf0b7", "• ")
    text = re.sub(r"[\u2009]", " ", text)          # espace fine
    text = re.sub(r" +", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# ── Extraction typographique ───────────────────────────────────────────────────
def is_title_span(span, threshold_big=18, threshold_mid=13):
    """Retourne le niveau de titre (1=chapitre, 2=section, 0=corps)."""
    size = span.get("size", 0)
    bold = bool(span.get("flags", 0) & 2**4) or "Bold" in span.get("font", "")
    if size >= threshold_big and bold:
        return 1
    if size >= threshold_mid and bold:
        return 2
    return 0

def extract_structured(path):
    """
    Parcourt le PDF span par span.
    Retourne une liste de sections : {level, title, content, page_start}
    """
    doc = fitz.open(path)
    sections = []
    cur_level = 0
    cur_title = ""
    cur_content = []
    cur_page = 1

    def flush():
        text = clean("\n".join(cur_content))
        if len(text) > 60:
            sections.append({
                "level"     : cur_level,
                "title"     : clean(cur_title),
                "content"   : text,
                "page_start": cur_page,
            })

    for page_num, page in enumerate(doc, 1):
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                line_text = " ".join(s["text"] for s in line["spans"]).strip()
                if not line_text:
                    continue

                # Déterminer si cette ligne est un titre
                max_level = max((is_title_span(s) for s in line["spans"]), default=0)

                if max_level == 1:
                    # Nouveau chapitre
                    flush()
                    cur_level   = 1
                    cur_title   = line_text
                    cur_content = []
                    cur_page    = page_num
                elif max_level == 2:
                    # Nouvelle section
                    flush()
                    cur_level   = 2
                    cur_title   = line_text
                    cur_content = []
                    cur_page    = page_num
                else:
                    cur_content.append(line_text)

    flush()
    return sections

# ── Fusion des petits chunks ───────────────────────────────────────────────────
def merge_small_chunks(sections, min_chars=300):
    """Fusionne les sections trop courtes avec la précédente."""
    merged = []
    for sec in sections:
        if merged and len(sec["content"]) < min_chars and sec["level"] >= merged[-1]["level"]:
            merged[-1]["content"] += "\n\n" + sec["title"] + "\n" + sec["content"]
        else:
            merged.append(sec)
    return merged

# ── Découpe des gros chunks ────────────────────────────────────────────────────
def split_large_chunks(sections, max_chars=3000):
    """Découpe les sections trop longues en sous-blocs par paragraphe."""
    result = []
    for sec in sections:
        if len(sec["content"]) <= max_chars:
            result.append(sec)
            continue
        # Découpe par doubles sauts de ligne
        paras = [p.strip() for p in sec["content"].split("\n\n") if p.strip()]
        buf, buf_len, part = [], 0, 1
        for para in paras:
            if buf_len + len(para) > max_chars and buf:
                result.append({**sec,
                    "title"  : f"{sec['title']} (partie {part})",
                    "content": "\n\n".join(buf)})
                buf, buf_len, part = [], 0, part + 1
            buf.append(para)
            buf_len += len(para)
        if buf:
            result.append({**sec,
                "title"  : f"{sec['title']} (partie {part})" if part > 1 else sec["title"],
                "content": "\n\n".join(buf)})
    return result

# ── Pipeline principal ─────────────────────────────────────────────────────────
def process_all(folder):
    files = sorted(glob.glob(os.path.join(folder, "**", "*.pdf"), recursive=True))
    if not files:
        print(f"Aucun PDF dans '{folder}'"); return []

    all_chunks = []
    for path in files:
        meta     = parse_filename(path)
        sections = extract_structured(path)
        sections = merge_small_chunks(sections)
        sections = split_large_chunks(sections)

        chunks = []
        for sec in sections:
            # Ignore pages de garde / crédits (trop courts ou mots-clés parasites)
            if len(sec["content"]) < 80:
                continue
            if re.match(r"(cet ouvrage|ce document|isbn|dépôt légal)", sec["content"], re.I):
                continue

            chunks.append({
                "cycle"        : meta["cycle"],
                "titre_guide"  : meta["titre"],
                "matiere"      : meta["matiere"],
                "niveau"       : meta["niveau"],
                "section"      : sec["title"],
                "niveau_section": "chapitre" if sec["level"] == 1 else "section",
                "page"         : sec["page_start"],
                "contenu"      : sec["content"],
                "texte_complet": "\n".join(filter(None, [
                    f"{meta['matiere']} — {meta['cycle']} — {meta['titre']}",
                    f"Niveau : {meta['niveau']}" if meta["niveau"] else "",
                    f"Section : {sec['title']}",
                    sec["content"],
                ])),
            })

        label = (f"  {meta['cycle']:8s} | {meta['matiere']:20s} | "
                 f"{meta['titre'][:45]:45s}  →  {len(chunks)} chunks")
        print(label)
        all_chunks.extend(chunks)

    return all_chunks

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dossier", default="guides_raw/Guides")
    parser.add_argument("--sortie",  default="guides.json")
    args = parser.parse_args()

    print(f"=== Extraction — {args.dossier} ===\n")
    chunks = process_all(args.dossier)
    if not chunks:
        exit(1)

    with open(args.sortie, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {len(chunks)} chunks  →  '{args.sortie}'")

    # Aperçu d'un chunk représentatif
    sample = next((c for c in chunks if len(c["contenu"]) > 400), chunks[0])
    print("\n── Exemple de chunk ──")
    d = {k: v for k, v in sample.items() if k != "texte_complet"}
    d["contenu"] = d["contenu"][:300] + "..."
    print(json.dumps(d, ensure_ascii=False, indent=2))

    # Stats
    from collections import Counter
    print("\n── Répartition ──")
    stats = Counter(f"{c['matiere']:22s} {c['cycle']}" for c in chunks)
    for k, v in sorted(stats.items()):
        print(f"  {k:35s}  {v:4d} chunks")
