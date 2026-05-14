"""
Extraction du Code de l'éducation (index Légifrance) → code_education.json
Chunk = un Chapitre, avec sa hiérarchie complète en métadonnées.

Usage : python extract_code_education.py [--fichier ...] [--sortie ...]
"""

import fitz, re, json, argparse

# ── Nettoyage ──────────────────────────────────────────────────────────────────
def clean(text):
    # Supprime les footers Légifrance
    text = re.sub(
        r"Code de l'éducation - Légifrance\nhttps?://[^\n]+\n[^\n]+\n",
        "", text
    )
    text = re.sub(r"\xa0", " ", text)
    text = re.sub(r" +", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# ── Extraction des articles listés ────────────────────────────────────────────
def extract_articles(text):
    """Retourne la liste des identifiants d'articles trouvés dans un bloc."""
    return re.findall(r"[LRD]\d{3,}-[\d\-]+(?:-\d+)*", text)

# ── Parser principal ───────────────────────────────────────────────────────────
def parse(text):
    """
    Parcourt le texte ligne par ligne et reconstruit la hiérarchie :
    Partie > Livre > Titre > Chapitre > Section/Sous-section
    Produit un chunk par Chapitre (unité sémantique minimale utile pour le RAG).
    """
    chunks = []

    # Hiérarchie courante
    ctx = {
        "partie"  : "",
        "livre"   : "",
        "titre"   : "",
        "chapitre": "",
        "section" : "",
    }
    cur_lines  = []
    cur_articles = []

    # Patterns de détection (ordre = priorité hiérarchique)
    RE_PARTIE   = re.compile(r"^(Première|Deuxième|Troisième|Quatrième)\s+partie\s*:(.+)", re.I)
    RE_LIVRE    = re.compile(r"^Livre\s+[IVXivx]+\s*:(.+)", re.I)
    RE_TITRE    = re.compile(r"^Titre\s+[IVXivx\w]+\s*:(.+)", re.I)
    RE_CHAPITRE = re.compile(r"^Chapitre\s+.+", re.I)
    RE_SECTION  = re.compile(r"^(Section|Sous-section|Paragraphe|Sous-paragraphe)\s+.+", re.I)
    RE_ARTICLE  = re.compile(r"^(Article\s+[LRD]\d)", re.I)

    def flush():
        """Sauvegarde le chapitre courant comme chunk."""
        if not ctx["chapitre"] or not cur_lines:
            return
        content = "\n".join(cur_lines).strip()
        if len(content) < 20:
            return
        articles = extract_articles(content)

        chunks.append({
            "source"    : "Code de l'éducation",
            "partie"    : ctx["partie"],
            "livre"     : ctx["livre"],
            "titre"     : ctx["titre"],
            "chapitre"  : ctx["chapitre"],
            "nb_articles": len(articles),
            "articles"  : articles,
            "contenu"   : content,
            "texte_complet": "\n".join(filter(None, [
                "Code de l'éducation",
                f"Partie : {ctx['partie']}"   if ctx['partie']   else "",
                f"Livre : {ctx['livre']}"     if ctx['livre']    else "",
                f"Titre : {ctx['titre']}"     if ctx['titre']    else "",
                f"Chapitre : {ctx['chapitre']}",
                content,
            ])),
        })

    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line:
            cur_lines.append("")
            continue

        # Partie
        m = RE_PARTIE.match(line)
        if m:
            flush()
            ctx["partie"]   = (m.group(1) + " partie : " + m.group(2)).strip()
            ctx["livre"]    = ctx["titre"] = ctx["chapitre"] = ctx["section"] = ""
            cur_lines = []
            continue

        # Livre
        m = RE_LIVRE.match(line)
        if m:
            flush()
            ctx["livre"]    = line.strip()
            ctx["titre"]    = ctx["chapitre"] = ctx["section"] = ""
            cur_lines = []
            continue

        # Titre
        m = RE_TITRE.match(line)
        if m:
            flush()
            ctx["titre"]    = line.strip()
            ctx["chapitre"] = ctx["section"] = ""
            cur_lines = []
            continue

        # Chapitre
        m = RE_CHAPITRE.match(line)
        if m:
            flush()
            ctx["chapitre"] = line.strip()
            ctx["section"]  = ""
            cur_lines = [line]
            continue

        # Section (dans le chapitre courant, pas un nouveau chunk)
        m = RE_SECTION.match(line)
        if m:
            ctx["section"] = line.strip()
            cur_lines.append(line)
            continue

        # Ligne normale (articles, descriptions, etc.)
        cur_lines.append(line)

    flush()  # dernier chunk
    return chunks

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--fichier", default="Code_de_l_éducation.pdf")
    parser.add_argument("--sortie",  default="code_education.json")
    args = parser.parse_args()

    print(f"=== Extraction — {args.fichier} ===\n")

    doc  = fitz.open(args.fichier)
    full = "\n".join(p.get_text() for p in doc)
    full = clean(full)

    chunks = parse(full)

    if not chunks:
        print("Aucun chunk extrait.")
        exit(1)

    with open(args.sortie, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    print(f"✓ {len(chunks)} chunks  →  '{args.sortie}'")

    # Aperçu
    sample = next((c for c in chunks if c["nb_articles"] > 3), chunks[0])
    print("\n── Exemple de chunk ──")
    d = {k: v for k, v in sample.items() if k != "texte_complet"}
    d["articles"] = d["articles"][:8]
    d["contenu"]  = d["contenu"][:200] + "..."
    print(json.dumps(d, ensure_ascii=False, indent=2))

    # Stats par partie
    from collections import Counter
    print("\n── Répartition par partie ──")
    stats = Counter(c["partie"][:60] for c in chunks)
    for k, v in sorted(stats.items()):
        print(f"  {k:65s}  {v:4d} chunks")

    print(f"\n── Couverture articles ──")
    all_articles = [a for c in chunks for a in c["articles"]]
    print(f"  {len(all_articles)} références d'articles indexées")
    print(f"  {len(set(all_articles))} articles uniques")
