import requests
from bs4 import BeautifulSoup
import json

# URL du Cycle 4
URL_AJAX = "https://www.edumoov.com/skills_items/ajax/7"

# On simule un vrai navigateur très précisément
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://www.edumoov.com/skills_repositories/current'
}

def extract():
    print("Tentative d'extraction forcée...")
    
    # Utilisation d'une session pour garder les cookies
    session = requests.Session()
    response = session.get(URL_AJAX, headers=headers)

    if response.status_code != 200:
        print(f"Erreur de connexion : {response.status_code}")
        return

    # On vérifie ce qu'on reçoit vraiment
    contenu = response.text
    if not contenu or len(contenu) < 50:
        print("Le serveur a renvoyé une réponse vide. Il bloque peut-être les requêtes automatiques.")
        return

    # Analyse du contenu (souvent du HTML brut envoyé via Ajax)
    soup = BeautifulSoup(contenu, 'html.parser')
    
    data_finale = []
    # Sur Edumoov, les domaines sont souvent dans des balises avec la classe 'domain-title' ou 'h4'
    # On va chercher tous les éléments qui ressemblent à des titres ou des compétences
    sections = soup.find_all(['h4', 'li'])

    current_domaine = "Inconnu"

    for tag in sections:
        text = tag.get_text(strip=True)
        if not text: continue

        if tag.name == 'h4':
            current_domaine = text
        else:
            data_finale.append({
                "domaine": current_domaine,
                "competence": text
            })

    # Sauvegarde
    with open('competences_cycle4.json', 'w', encoding='utf-8') as f:
        json.dump(data_finale, f, ensure_ascii=False, indent=4)

    if data_finale:
        print(f"Succès ! {len(data_finale)} compétences extraites dans 'competences_cycle4.json'.")
    else:
        print("Le script a réussi à lire la page, mais n'a trouvé aucune balise <h4> ou <li>. La structure a peut-être changé.")

if __name__ == "__main__":
    extract()