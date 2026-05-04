# Sage App

Application web MVP pour enseignant, créée avec Next.js, TypeScript et Tailwind CSS.

## Objectif du MVP

- Charger les données depuis `Référentiel_de_compétences.json`.
- Afficher une sélection en cascade : Cycle → Niveau → Domaine → Sous-domaine → Item → Compétence.
- Afficher la compétence sélectionnée.
- Générer un objectif pédagogique avec l'API OpenAI.
- Générer une progression de séquence à partir des choix et de l'objectif.
- Préparer une séance détaillée à partir d'une séance choisie dans la progression.
- Exporter la séance préparée en PDF via l'impression du navigateur.
- Envoyer une séance préparée dans la réserve du planning.
- Retrouver les séances préparées dans une bibliothèque persistante.
- Gérer les élèves et les suivis dans un tableau éditable.
- Sauvegarder les données localement par utilisateur.
- Afficher les évènements Google Agenda dans le cahier journal.
- Suivre les progrès des élèves avec des évaluations.

## Installation

Dans ce dossier, lancez :

```bash
npm install
```

## Configuration OpenAI

Créez un fichier `.env.local` à la racine du projet :

```env
OPENAI_API_KEY=votre_cle_api_openai
OPENAI_MODEL=gpt-5.4-mini
NEXT_PUBLIC_GOOGLE_CLIENT_ID=votre_client_id_google
NEXT_PUBLIC_GOOGLE_API_KEY=votre_api_key_google
```

La clé reste côté serveur grâce à la route `app/api/generate-objective/route.ts`.

Pour Google Agenda, activez l'API Google Calendar dans Google Cloud, créez un client OAuth
Web et une clé API, puis ajoutez `http://localhost:3000` dans les origines JavaScript autorisées.

## Démarrage

Puis lancez le serveur de développement :

```bash
npm run dev
```

Ouvrez ensuite :

```text
http://localhost:3000
```

## Structure des fichiers

- `app/page.tsx` : tableau de bord principal avec navigation et vue globale de la classe.
- `app/preparation/page.tsx` : page de préparation avec formulaire, filtres en cascade et appels à l'API.
- `app/api/generate-objective/route.ts` : route serveur qui appelle l'API OpenAI.
- `app/api/generate-sequence/route.ts` : route serveur qui génère la progression de séquence.
- `app/api/generate-lesson/route.ts` : route serveur qui prépare une séance détaillée.
- `app/planning/page.tsx` : page planning du lundi au vendredi, de 8h à 17h, en tranches de 5 minutes.
- `app/bibliotheque/page.tsx` : bibliothèque des séances préparées, organisée par cycle, niveau, domaine, sous-domaine et séquence.
- `app/eleves/page.tsx` : tableau de suivi des élèves avec champs éditables et cases à cocher.
- `app/progression/page.tsx` : suivi des évaluations et des niveaux d'acquisition des élèves.
- `app/parametres/page.tsx` : choix ou création de l'utilisateur local actif.
- `app/lib/user-storage.ts` : lecture/écriture locale des données séparées par utilisateur.
- `app/layout.tsx` : structure globale de l'application Next.js.
- `app/globals.css` : styles globaux et activation de Tailwind CSS.
- `Référentiel_de_compétences.json` : données importées depuis l'ancien fichier Excel.
- `package.json` : dépendances et commandes du projet.
- `tailwind.config.ts` : configuration Tailwind CSS.
- `tsconfig.json` : configuration TypeScript.

## Commandes utiles

```bash
npm run dev
npm run build
npm run lint
```
