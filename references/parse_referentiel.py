#!/usr/bin/env python3
"""
Génère Référentiel_de_compétences.json à partir des fichiers texte des 4 cycles.

Règle clé : quand plusieurs marqueurs de niveau se succèdent avant une compétence
(ex: CM1 / 6ème / CM2), la compétence est créée pour TOUS ces niveaux.
Quand aucun niveau n'est précisé (cycle 4), la compétence s'applique aux 3 niveaux du cycle.
"""

import json
import re
from pathlib import Path
from collections import Counter


def find_next_non_empty(lines, start):
    for j in range(start, len(lines)):
        if lines[j].strip():
            return lines[j]
    return None


def make_entry(cycle, niveau, domaine, sous_domaine, item, competence):
    return {
        "Cycle": cycle,
        "Niveau": niveau,
        "Domaine": (domaine or "").strip(),
        "Sous-domaine": (sous_domaine or "").strip(),
        "Item": (item or "").strip(),
        "Compétence": competence.strip(),
    }


# ─────────────────────────────────────────────────────────────
# CYCLE 1  (PS / MS / GS)
# Format :
#   0 espace  → domaine principal
#   1 espace  → sous-domaine ou item (déterminé par look-ahead)
#   ligne commençant par "X ans" → compétence avec préfixe d'âge
# ─────────────────────────────────────────────────────────────
def parse_cycle1(filepath):
    AGE_MAP = [("3 ans", "PS"), ("4 ans", "MS"), ("5 ans", "GS")]
    CYCLE = "Cycle 1"

    with open(filepath, "r", encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f.readlines()]

    entries = []
    domaine = None
    sous_domaine = None
    item = None

    for i, line in enumerate(lines):
        if not line.strip():
            continue
        stripped = line.strip()

        # Ligne commençant par un préfixe d'âge → compétence
        age_match = re.match(r"^((?:(?:3|4|5) ans\s*)+)(.*)", stripped)
        if age_match:
            ages_str = age_match.group(1)
            competence = age_match.group(2).strip()
            if not competence:
                continue
            niveaux = [n for a, n in AGE_MAP if a in ages_str]
            for niveau in niveaux:
                entries.append(make_entry(CYCLE, niveau, domaine, sous_domaine, item, competence))
            continue

        if not line.startswith(" "):
            # 0 espace → domaine principal
            domaine = stripped
            sous_domaine = None
            item = None
        else:
            # 1 espace → sous-domaine ou item selon ce qui suit
            next_line = find_next_non_empty(lines, i + 1)
            is_next_space = next_line and next_line.startswith(" ") and not re.match(
                r"^(?:3|4|5) ans", next_line.strip()
            )
            if is_next_space:
                sous_domaine = stripped
                item = None
            else:
                item = stripped

    return entries


# ─────────────────────────────────────────────────────────────
# CYCLES 2 & 3  (CP/CE1/CE2  et  CM1/CM2/6ème)
# Format :
#   marqueur de niveau seul sur sa ligne (peut s'empiler)
#   ligne suivante après un ou plusieurs marqueurs → compétence
#   1 espace  → domaine (si suivi d'une autre ligne à 1 espace) ou sous-domaine
#   0 espace non-marqueur → domaine (si suivi d'une ligne à 1 espace) ou item
# ─────────────────────────────────────────────────────────────
def parse_cycle_2_or_3(filepath, cycle_name, niveaux_list):
    niveau_set = set(niveaux_list)

    with open(filepath, "r", encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f.readlines()]

    entries = []
    domaine = None
    sous_domaine = None
    item = None
    pending_niveaux = []  # accumule les marqueurs empilés

    for i, line in enumerate(lines):
        if not line.strip():
            continue
        stripped = line.strip()

        if stripped in niveau_set:
            # Marqueur de niveau : on accumule (plusieurs peuvent précéder une compétence)
            pending_niveaux.append(stripped)

        elif line.startswith(" "):
            # Ligne à 1 espace → domaine ou sous-domaine
            pending_niveaux = []
            next_line = find_next_non_empty(lines, i + 1)
            next_is_space = (
                next_line
                and next_line.startswith(" ")
                and next_line.strip() not in niveau_set
            )
            if next_is_space:
                # Suivi d'une autre ligne à espace → niveau domaine
                domaine = stripped
                sous_domaine = None
                item = None
            else:
                sous_domaine = stripped
                item = None

        else:
            # 0 espace, pas un marqueur de niveau
            if pending_niveaux:
                # C'est une compétence (après marqueurs empilés)
                for niveau in pending_niveaux:
                    entries.append(
                        make_entry(cycle_name, niveau, domaine, sous_domaine, item or "", stripped)
                    )
                pending_niveaux = []
            else:
                # Domaine ou item selon ce qui suit
                next_line = find_next_non_empty(lines, i + 1)
                next_is_space = (
                    next_line
                    and next_line.startswith(" ")
                    and next_line.strip() not in niveau_set
                )
                if next_is_space:
                    domaine = stripped
                    sous_domaine = None
                    item = None
                else:
                    item = stripped

    return entries


# ─────────────────────────────────────────────────────────────
# CYCLE 4  (5ème / 4ème / 3ème)
# Format basé sur l'indentation :
#   0  espaces → domaine
#   4  espaces → sous-domaine
#   8  espaces → item (si suivi de 12 espaces) ou compétence générale (tous niveaux)
#   12 espaces → marqueur de niveau, compétence spécifique, compétence générale ou titre de sous-item
# ─────────────────────────────────────────────────────────────
def parse_cycle4(filepath):
    NIVEAUX_C4 = {"5ème", "4ème", "3ème"}
    ALL = ["5ème", "4ème", "3ème"]
    CYCLE = "Cycle 4"

    with open(filepath, "r", encoding="utf-8") as f:
        lines = [l.rstrip("\n") for l in f.readlines()]

    entries = []
    domaine = None
    sous_domaine = None
    item = None
    sub_item = None
    pending_niveaux = []

    for i, line in enumerate(lines):
        if not line.strip():
            continue
        stripped = line.strip()
        indent = len(line) - len(line.lstrip(" "))

        if indent == 0:
            domaine = stripped
            sous_domaine = None
            item = None
            sub_item = None
            pending_niveaux = []

        elif indent == 4:
            sous_domaine = stripped
            item = None
            sub_item = None
            pending_niveaux = []

        elif indent == 8:
            if pending_niveaux:
                for niveau in pending_niveaux:
                    entries.append(
                        make_entry(CYCLE, niveau, domaine, sous_domaine, item or sub_item or "", stripped)
                    )
                pending_niveaux = []
            else:
                next_line = find_next_non_empty(lines, i + 1)
                next_indent = len(next_line) - len(next_line.lstrip(" ")) if next_line else 0
                if next_line and next_indent >= 12:
                    # A des enfants à 12 espaces → c'est un item
                    item = stripped
                    sub_item = None
                else:
                    # Compétence générale pour tous les niveaux
                    for niveau in ALL:
                        entries.append(
                            make_entry(CYCLE, niveau, domaine, sous_domaine, item or "", stripped)
                        )

        elif indent >= 12:
            if stripped in NIVEAUX_C4:
                pending_niveaux.append(stripped)
            elif pending_niveaux:
                # Compétence spécifique à certains niveaux
                for niveau in pending_niveaux:
                    entries.append(
                        make_entry(CYCLE, niveau, domaine, sous_domaine, item or sub_item or "", stripped)
                    )
                pending_niveaux = []
            else:
                # Compétence générale ou titre de sous-item
                next_line = find_next_non_empty(lines, i + 1)
                if next_line and next_line.strip() in NIVEAUX_C4:
                    # Suivi d'un marqueur de niveau → titre de sous-item
                    sub_item = stripped
                else:
                    # Compétence générale pour tous les niveaux
                    for niveau in ALL:
                        entries.append(
                            make_entry(CYCLE, niveau, domaine, sous_domaine, item or sub_item or "", stripped)
                        )

    return entries


def main():
    base = Path(__file__).parent
    json_path = base.parent / "Référentiel_de_compétences.json"

    # Garder cycles 1 et 2 de l'original (données Edumoov plus riches)
    print("Lecture du JSON original (cycles 1 et 2 conservés)...")
    with open(json_path, "r", encoding="utf-8") as f:
        original = json.load(f)
    kept = [e for e in original if e["Cycle"] in ("Cycle 1", "Cycle 2")]
    c1_c2_counts = Counter((e["Cycle"], e["Niveau"]) for e in kept)
    for (cycle, niveau), count in sorted(c1_c2_counts.items()):
        print(f"  {cycle} / {niveau}: {count} (conserve)")

    # Regénérer cycles 3 et 4 depuis les fichiers texte
    print("\nParsing Cycle 3 (fix marqueurs empiles)...")
    c3 = parse_cycle_2_or_3(base / "Compétences_cycle_3.txt", "Cycle 3", ["CM1", "CM2", "6ème"])
    print(f"  Cycle 3: {len(c3)} entrees")

    print("Parsing Cycle 4 (competences generales dupliquees sur tous niveaux)...")
    c4 = parse_cycle4(base / "competences_cycle_4.txt")
    print(f"  Cycle 4: {len(c4)} entrees")

    all_entries = kept + c3 + c4
    print(f"\nTotal: {len(all_entries)} entrees\n")

    counts = Counter((e["Cycle"], e["Niveau"]) for e in all_entries)
    for (cycle, niveau), count in sorted(counts.items()):
        print(f"  {cycle} / {niveau}: {count}")

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_entries, f, ensure_ascii=False, indent=2)
    print(f"\nFichier ecrit: {json_path}")


if __name__ == "__main__":
    main()
