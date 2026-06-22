# SAGE

**Système d'Assistance et de Gestion Éducative**

Application d'aide à la préparation pédagogique pour les enseignants : du référentiel de compétences jusqu'à la séance prête à imprimer, avec génération assistée par IA, planning, bibliothèque persistante et suivi des élèves.

Développée avec Next.js, TypeScript et Tailwind CSS.

> 🧪 **Bêta ouverte.** SAGE est en cours de développement et partagé pour test. Des aspérités sont attendues — c'est le but. Tous les retours sont bienvenus.

---

## ⚠️ Données personnelles & RGPD — à lire avant de l'utiliser

Dans son état actuel, SAGE peut faire transiter des données par un service hébergé (Supabase). **Pendant la bêta, n'entrez pas de données réelles permettant d'identifier des élèves** (noms, prénoms, évaluations nominatives). Utilisez des données de test ou anonymisées (« Élève 1 », « Élève 2 »…).

La trajectoire du projet est un fonctionnement **100 % local** (voir la [feuille de route](#feuille-de-route)), où aucune donnée ne quittera la machine de l'utilisateur. Tant que cette bascule n'est pas faite, considérez cette consigne comme stricte.

---

## Fonctionnalités

- Chargement des données depuis `Référentiel_de_compétences.json`.
- Sélection en cascade : Cycle → Niveau → Domaine → Sous-domaine → Item → Compétence.
- Génération d'un **objectif pédagogique** à partir de la compétence choisie (IA).
- Génération d'une **progression de séquence** à partir des choix et de l'objectif (IA).
- Préparation d'une **séance détaillée** à partir d'une séance de la progression (IA).
- Export de la séance préparée en **PDF** (via l'impression du navigateur).
- Envoi d'une séance dans la **réserve du planning** (lundi → vendredi, 8h–17h).
- **Bibliothèque persistante** des séances préparées, organisée par cycle / niveau / domaine / sous-domaine / séquence.
- **Gestion des élèves** dans un tableau éditable.
- **Suivi des progrès** : évaluations et niveaux d'acquisition.
- **Cahier journal** avec affichage des évènements Google Agenda.
- Sauvegarde des données **par utilisateur local**.

---

## Stack technique

- **Next.js** (App Router) — framework React
- **TypeScript**
- **Tailwind CSS**
- **API OpenAI** — génération de contenu pédagogique
- **Supabase** — persistance (en cours de remplacement, cf. feuille de route)
- **Electron** — empaquetage application de bureau (en cours)

---

## Prérequis

- **Node.js** 18 ou supérieur et **npm**
- Une **clé API OpenAI** (chaque utilisateur fournit la sienne — *Bring Your Own Key*)
- Un **projet Supabase** (le temps de la migration vers un stockage local)

---

## Installation

Clonez le dépôt, puis dans le dossier du projet :

```bash
npm install
```

---

## Configuration

Créez un fichier `.env.local` à la racine du projet. Ce fichier est ignoré par git (`.gitignore`) et ne doit **jamais** être commité.

Un modèle est fourni dans `.env.example`.

### OpenAI

```env
OPENAI_API_KEY=votre_cle_api_openai
OPENAI_MODEL=gpt-5.4-mini
```

La clé reste côté serveur grâce aux routes API (`app/api/.../route.ts`) et n'est jamais exposée au navigateur.

### Supabase

Créez un projet sur [supabase.com](https://supabase.com), puis récupérez l'URL et les clés dans **Project Settings → API** :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
```

> 🔐 **`SUPABASE_SERVICE_ROLE_KEY` est une clé d'administration : elle contourne les Row Level Security policies.** Elle ne doit être lue que dans des routes serveur, jamais exposée côté client ni embarquée dans un build distribué.

Le schéma de base de données se trouve dans le dossier `supabase/`.

---

## Démarrage

Lancez le serveur de développement :

```bash
npm run dev
```

Puis ouvrez [http://localhost:3000](http://localhost:3000).

---

## Structure du projet

```
app/
  page.tsx                      Tableau de bord principal (vue globale de la classe)
  preparation/page.tsx          Préparation : filtres en cascade + appels IA
  planning/page.tsx             Planning hebdomadaire (lun→ven, 8h–17h)
  bibliotheque/page.tsx         Bibliothèque des séances préparées
  eleves/page.tsx               Tableau de suivi des élèves
  progression/page.tsx          Suivi des évaluations et niveaux d'acquisition
  parametres/page.tsx           Choix / création de l'utilisateur local actif
  api/generate-objective/       Route serveur — objectif pédagogique (OpenAI)
  api/generate-sequence/        Route serveur — progression de séquence (OpenAI)
  api/generate-lesson/          Route serveur — séance détaillée (OpenAI)
  lib/user-storage.ts           Lecture / écriture locale par utilisateur
  layout.tsx                    Structure globale de l'application
  globals.css                   Styles globaux + Tailwind
electron/                       Empaquetage application de bureau
supabase/                       Schéma de base de données
Référentiel_de_compétences.json Données du référentiel (issu de l'ancien Excel)
```

---

## Commandes utiles

```bash
npm run dev      # serveur de développement
npm run build    # build de production
npm run lint     # vérification du code
```

---

## Feuille de route

- [ ] **Passage en stockage 100 % local** (SQLite via `better-sqlite3`) et retrait de Supabase — pour que les données ne quittent jamais la machine de l'utilisateur (objectif RGPD).
- [ ] **Build Electron** distribuable, sans dépendance à un service en ligne.
- [ ] Modèle **BYOK** généralisé : chaque utilisateur configure sa propre clé OpenAI en local.

---

## Licence

Ce projet est distribué sous licence **GNU Affero General Public License v3.0 (AGPL-3.0)**. Voir le fichier [`LICENSE`](./LICENSE).

Copyright (C) 2026 Étienne — [àlaclé](https://alacle.org)

En résumé :

- Vous êtes libre d'utiliser, d'étudier, de modifier et de redistribuer SAGE.
- **Toute version modifiée et redistribuée doit elle-même rester ouverte sous AGPL-3.0** — y compris si elle est mise à disposition via un service en réseau (l'AGPL ferme le « trou SaaS » : héberger une version modifiée oblige à en publier le code source).
- Les mentions de copyright doivent être conservées et les modifications signalées.
- Le logiciel est fourni « tel quel », sans aucune garantie.

Ce choix de licence vise à garantir que SAGE **reste libre et ouvert pour toujours** : personne ne peut s'en saisir pour en faire une version fermée et propriétaire. Une version commerciale fermée de SAGE par un tiers est impossible sous cette licence.

> En tant que titulaire des droits, l'auteur conserve la liberté d'utiliser SAGE selon d'autres modalités. L'AGPL ne lie que les tiers.

---

## Auteur

Développé par Étienne dans le cadre de [àlaclé](https://alacle.org).

🌐 [alacle.org](https://alacle.org)
