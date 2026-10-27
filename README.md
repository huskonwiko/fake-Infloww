# Velvet — CRM Studio

CRM indépendant de simulation, construit avec Next.js, React, TypeScript, Tailwind CSS, des composants UI de style shadcn/Radix, Recharts, Zustand, Dexie, dnd-kit, Zod et Lucide. Aucune API OnlyFans ou Infloww, aucun compte et aucune donnée réelle ne sont nécessaires.

## Lancer sur votre ordinateur

Prérequis : **Node.js 24 ou plus récent**, npm et un navigateur moderne acceptant IndexedDB.

```bash
npm ci
npm run dev
```

Ouvrez `http://localhost:3000`. Pour un lancement de production :

```bash
npm run build
npm start
```

Aucune variable d’environnement, base distante ou clé API à configurer. Le registre npm n’est utilisé qu’à l’installation. L’application ne contacte aucun service externe pour ses données, images, messages ou ventes.

## Utilisation

- **EDIT MODE** active les modifications des fiches, tables, messages et KPI. Cliquez sur une valeur de KPI pour saisir une valeur personnalisée, une évolution et une couleur, ou revenir au calcul automatique.
- **Créatrice et période** filtrent les revenus, rapports et courbes. Les compteurs représentant l’état actuel d’un profil portent la mention « Current snapshot ». Les périodes suivent des jours calendaires UTC.
- **Graphiques** : cliquez sur la courbe en mode édition ou sur son bouton d’édition. Modifiez les points dans le tableau ou par déplacement, ajoutez/supprimez points et séries, changez couleurs, légendes, type et échelle. La sélection multiple applique une valeur à plusieurs points. L’import CSV accepte des colonnes `date,Nom de série,...` et des dates `YYYY-MM-DD`. Les réglages sont isolés par graphique, créatrice et période (dates incluses pour une période personnalisée).
- **Calculé / personnalisé** : les transactions alimentent les KPI et graphiques calculés. Les valeurs manuelles sont identifiées et indépendantes des transactions ; elles ne modifient pas les ventes sources. Les séries supplémentaires manuelles utilisent le mode personnalisé.
- **Studio Editor** : KPI, feuilles de données éditables pour toutes les collections, courbes, ordre des widgets et source JSON validée. Sauvegarde automatique, sauvegarde explicite, annulation/rétablissement, réinitialisation et duplication. L’ordre des cartes du dashboard se change aussi en glissant leurs poignées en mode édition.
- **CRM** : création, modification et suppression de créatrices, employés, fans, transactions, campagnes, liens de suivi, scripts et listes. Recherche, tri et pagination des tables, export CSV, profils et rapports, avec courbes individuelles par créatrice et par chatter. Le planning permet de déplacer un horaire sur un autre jour.
- **Messages Pro** : conversations locales, notes, tags, images importées depuis votre appareil, scripts et ventes PPV simulées. Une vente PPV crée une transaction liée ; modifier ou supprimer le message met cette vente à jour. Les messages groupés créent uniquement des messages locaux, sans simuler leur achat automatiquement.
- **Settings** : nom du studio, devise, thème sombre/clair et couleurs des créatrices. La devise change l’affichage, sans conversion de change.
- **Demo scenarios** : créez, dupliquez, chargez ou supprimez des scénarios indépendants. L’import JSON crée un nouveau scénario et préserve les précédents.

Les données initiales comprennent **4 créatrices, 8 chatters, 250 fans, 1 000 transactions, 90 jours d’historique**, des conversations et des campagnes fictives. Les montants nets simulent une commission de 20 %. Les heures, messages envoyés et conversions enregistrées des employés sont des données manuelles explicitement identifiées ; leur période n’est pas un historique de pointage. Campagnes et liens sont des simulations locales, sans suivi public réel.

## Sauvegarde et confidentialité

Dexie enregistre les scénarios et préférences dans **IndexedDB, dans le navigateur et sur l’origine utilisée** (hôte + port). Changer de navigateur ou de port n’ouvre pas le même stockage. Les données ne sont pas enregistrées dans les fichiers du serveur et ne sont pas partagées entre utilisateurs.

Exportez régulièrement chaque scénario via **Export** ou **Settings → Import / Export**. Le JSON inclut profils, images locales, messages, ventes, courbes, personnalisations et préférences du scénario. L’import vérifie les types, les dates et les relations entre fiches avant toute modification. Un export CSV de table est destiné à l’analyse ; le JSON sert à restaurer un scénario entier.

Effacer les données du navigateur supprime les scénarios locaux. L’application signale les échecs de sauvegarde ; dans ce cas, exportez avant de fermer. Undo/Redo conserve les 40 derniers états de données de la session, et repart à zéro au changement de scénario ou au rechargement. Réinitialiser un scénario peut être annulé pendant la session.

## Vérifications

```bash
npm run typecheck
npm test
npm run build
```

Les tests unitaires vérifient les revenus, les périodes, les agrégations, l’isolation des créatrices, l’édition et le CSV des graphiques, la validation JSON, IndexedDB, les scénarios, les préférences, l’historique et les erreurs de sauvegarde.

Les tests navigateur utilisent une instance déjà démarrée et des contextes isolés :

```bash
npx playwright install chromium
npm run dev
# Dans un autre terminal :
npm run test:browser
```

Un Chromium système est détecté sous Linux ; `CHROMIUM_PATH` permet d’indiquer un autre exécutable. Les scripts acceptent `CRM_BASE_URL` (ou `BASE_URL` pour la messagerie) si le port diffère. Ils vérifient les interactions réellement rendues, le recalcul, les courbes SVG, le planning, les ventes PPV, l’import/export et la persistance après rechargement.

## Architecture

- `app/` : point d’entrée Next.js, métadonnées, styles et identité visuelle.
- `components/studio-app.tsx` : navigation, filtres communs, état de sauvegarde.
- `components/dashboard.tsx` : KPI calculés/personnalisés et widgets réorganisables.
- `components/chart-panel.tsx` : graphiques Recharts et éditeur de courbes/CSV.
- `components/crm-pages.tsx`, `entity-table.tsx` : modules CRM et formulaires réutilisables.
- `components/messages-page.tsx` : messagerie simulée et synchronisation PPV.
- `components/studio-page.tsx`, `settings-page.tsx` : édition des données, scénarios et réglages.
- `lib/types.ts`, `seed.ts`, `analytics.ts`, `schema.ts`, `store.ts`, `db.ts` : modèle, données, calculs, validation, état et persistance.
- `tests/` : tests de calculs/persistance et parcours Chromium.

L’identité Velvet est originale. Aucune ressource propriétaire d’Infloww n’est incluse. Sans captures fournies, l’interface est une interprétation du brief ; elle ne prétend pas être une copie visuelle vérifiée d’une interface privée.
