"""
Extraction et parsing des PDFs "Attendus de fin d'année"
Produit attendus.json prêt à indexer dans ChromaDB ou tout autre store.

Usage : python extract_attendus.py [--dossier Attendus]
"""

import fitz
import re
import json
import glob
import os
import argparse

def decode_filename(name):
    return re.sub(r"#U([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), name)

def parse_filename(path):
    name = decode_filename(os.path.basename(path))
    name = re.sub(r"^\d+ - ", "", name).replace(".pdf", "")
    m = re.match(r"(.+?) - attendus de fin de (.+)", name, re.IGNORECASE)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return name, "inconnu"

def extract_raw(path):
    doc = fitz.open(path)
    return [page.get_text() for page in doc]

def clean(text):
    text = re.sub(r"[\uf0b7\uf0a7\u2022\u25cf\u25aa]", "•", text)
    text = re.sub(r"^\s*[o•]\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r" +", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"Attendus de fin d[''']ann[ée]e\s*de\s*\w+\s*", "", text)
    return text.strip()

def parse_pages(pages, matiere, niveau):
    chunks = []
    for page_num, raw in enumerate(pages, 1):
        text = clean(raw)
        if len(text) < 30:
            continue
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        domaine, competence, criteres, exemples, mode = "", "", [], [], None

        def flush():
            if not (criteres or exemples):
                return
            chunks.append({
                "matiere"   : matiere,
                "niveau"    : niveau,
                "domaine"   : domaine,
                "competence": competence,
                "criteres"  : "\n".join(criteres).strip(),
                "exemples"  : "\n".join(exemples).strip(),
                "page"      : page_num,
                "texte_complet": "\n".join(filter(None, [
                    f"{matiere} — {niveau}",
                    f"Domaine : {domaine}" if domaine else "",
                    f"Compétence : {competence}" if competence else "",
                    "Critères :", "\n".join(criteres),
                    "Exemples de réussite :" if exemples else "",
                    "\n".join(exemples),
                ])).strip()
            })

        for line in lines:
            if re.search(r"Ce que sait faire l[''']él[èe]ve", line, re.I):
                flush(); criteres=[]; exemples=[]; mode="criteres"; continue
            if re.search(r"Exemples?\s+de\s+r[ée]ussite", line, re.I):
                mode="exemples"; continue
            if re.match(r"En lien avec", line, re.I):
                continue
            if mode is None:
                if len(line) > 10:
                    if len(line) < 90 and not line.startswith("-"):
                        domaine = line
                    competence = line
            elif mode == "criteres": criteres.append(line)
            elif mode == "exemples": exemples.append(line)
        flush()
    return chunks

def fallback_pages(pages, matiere, niveau):
    chunks = []
    for i, raw in enumerate(pages, 1):
        text = clean(raw)
        if len(text) < 30: continue
        chunks.append({
            "matiere": matiere, "niveau": niveau,
            "domaine": f"page {i}", "competence": "",
            "criteres": text, "exemples": "", "page": i,
            "texte_complet": f"{matiere} — {niveau}\n{text}"
        })
    return chunks

def process_all(folder):
    files = sorted(glob.glob(os.path.join(folder, "*.pdf")))
    if not files:
        print(f"Aucun PDF dans '{folder}'"); return []
    all_chunks = []
    for path in files:
        matiere, niveau = parse_filename(path)
        pages = extract_raw(path)
        chunks = parse_pages(pages, matiere, niveau)
        if len(chunks) < 3:
            chunks = fallback_pages(pages, matiere, niveau)
            label = "pages"
        else:
            label = "compétences"
        print(f"  {matiere:20s} {niveau:6s}  →  {len(chunks):3d} chunks ({label})")
        all_chunks.extend(chunks)
    return all_chunks

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dossier", default="Attendus")
    parser.add_argument("--sortie",  default="attendus.json")
    args = parser.parse_args()

    print(f"=== Extraction — {args.dossier} ===\n")
    chunks = process_all(args.dossier)
    if not chunks: exit(1)

    with open(args.sortie, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {len(chunks)} chunks  →  '{args.sortie}'")

    sample = next((c for c in chunks if c["criteres"]), chunks[0])
    print("\n── Exemple de chunk ──")
    print(json.dumps(sample, ensure_ascii=False, indent=2)[:700])

    from collections import Counter
    stats = Counter(f"{c['matiere']:20s} {c['niveau']}" for c in chunks)
    print("\n── Répartition ──")
    for k, v in sorted(stats.items()):
        print(f"  {k:28s}  {v:3d} chunks")
