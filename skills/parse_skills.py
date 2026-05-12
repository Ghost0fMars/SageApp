import json

def parse_competences(input_file, output_file):
    # La structure racine : un dictionnaire pour les Domaines
    hierarchy = {}
    
    # On garde une trace du chemin actuel dans l'arbre
    # [Domaine, Sous-Domaine, Item]
    current_path = []

    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            # On ignore les lignes vides ou uniquement composées d'espaces
            stripped = line.rstrip()
            if not stripped.strip():
                continue
            
            # Calcul de l'indentation
            indent = len(stripped) - len(stripped.lstrip())
            content = stripped.strip()
            
            # Détermination du niveau selon l'indentation
            # Niveau 0 (0 espaces) : Domaine (ex: Français)
            # Niveau 1 (4 espaces) : Sous-domaine (ex: Langage oral)
            # Niveau 2 (8 espaces) : Item (ex: Comprendre et interpréter...)
            # Niveau 3 (12+ espaces) : Compétence précise
            
            level = indent // 4 # On suppose des paliers de 4 espaces
            
            # On ajuste le chemin actuel selon le niveau de la ligne
            current_path = current_path[:level]
            
            # Navigation et création dans le dictionnaire
            temp = hierarchy
            for node in current_path:
                temp = temp[node]
            
            # Ajout du contenu
            if level < 3:
                # C'est un conteneur (Domaine, Sous-domaine ou Item)
                if content not in temp:
                    temp[content] = {} if level < 2 else []
                current_path.append(content)
            else:
                # C'est une compétence finale (on l'ajoute à la liste de l'Item)
                if isinstance(temp, list):
                    temp.append(content)

    # Sauvegarde
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(hierarchy, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    try:
        parse_competences('competences_cycle4.txt', 'competences_cascade.json')
        print("Conversion réussie ! Le fichier 'competences_cascade.json' est prêt.")
    except Exception as e:
        print(f"Une erreur est survenue : {e}")