# Cahier des charges — Plateforme événementielle associative

**Version** : 0.1 (brouillon de travail)
**Date** : Juillet 2026

---

## 1. Présentation du projet

### 1.1 Contexte
La plateforme a pour but de centraliser la gestion d'événements organisés par des associations : inscription des participants, organisation logistique interne (tâches, cartographie), gestion des membres et de leurs rôles, et valorisation de la participation via un système de « hauts faits ».

### 1.2 Objectifs
- Permettre à des utilisateurs de découvrir et rejoindre des événements associatifs
- Permettre à des associations de gérer leurs membres, rôles et droits d'accès
- Outiller les organisateurs (Admin d'association) pour la logistique d'un événement (tâches, cartographie, validation de dossiers)
- Gamifier la participation via un système de hauts faits (badges)

### 1.3 Périmètre du MVP
**Inclus** :
- Authentification OAuth (Google, Discord)
- Gestion de profil utilisateur
- Création/gestion d'associations, membres, rôles, droits
- Création/consultation d'événements, inscriptions, dossiers costume avec motif de refus
- Kanban de tâches par événement
- Cartographie simple (placement d'éléments sur un plan)
- Hauts faits (création, réclamation, validation, attribution manuelle et automatique)

**Hors périmètre MVP** (pistes V2) :
- Paiement en ligne des inscriptions/cotisations
- Notifications push / emailing avancé
- Application mobile native
- Multi-langue

---

## 2. Acteurs

| Acteur | Origine | Description |
|---|---|---|
| Visiteur | — | Non authentifié |
| Utilisateur | Visiteur authentifié | Compte actif via OAuth |
| Membre d'association | Utilisateur | Rattaché à une association, porteur d'un ou plusieurs rôles |
| Admin d'association | Membre | Droits d'administration (créateur de l'association par défaut) |
| Système | — | Attribution automatique des hauts faits liés à la participation |
| Fournisseur OAuth | Externe | Google, Discord |

*(Détail des cas d'utilisation : voir `use_cases_plateforme.puml` / `.md`. Détail du modèle de données : voir diagramme de classes fourni précédemment.)*

---

## 3. Besoins fonctionnels

### 3.1 Compte utilisateur
- **RF-01** : Inscription exclusivement via OAuth (Google ou Discord), pas de mot de passe local
- **RF-02** : Un compte est identifié par le couple (provider, providerId), et non par l'email seul. **Décision** : pas de fusion automatique de comptes entre Google et Discord même si l'email correspond — c'est la pratique standard en sécurité OAuth (un email n'est pas garanti vérifié de façon homogène selon le provider, et une fusion automatique ouvre un vecteur de prise de compte). Une fonctionnalité explicite de "lier un second provider" pourra être ajoutée en V2, avec double authentification des deux comptes au moment de la liaison.
- **RF-03** : L'utilisateur complète son profil après première connexion (champs à définir : nom d'affichage, avatar, éventuellement coordonnées)
- **RF-04** : Suppression de compte : **décision** — soft-delete par anonymisation (remplacement des données identifiantes, conservation de l'historique d'événements/tâches pour l'intégrité des données de l'association). Conforme RGPD (droit à l'effacement respecté sur les données personnelles, données d'usage conservées sous forme anonymisée) ; purge physique complète possible sur demande explicite après période de rétention (ex. 30 jours), à formaliser dans la politique de confidentialité.

### 3.2 Associations
- **RF-05** : Tout utilisateur authentifié peut créer une association ; il en devient automatiquement Admin
- **RF-06** : Une association possède un jeu de rôles par défaut à sa création : Membre, Trésorier, Président, Membre du CA, Secrétaire
- **RF-07** : L'Admin peut créer des rôles personnalisés et modifier les rôles par défaut (renommage, droits associés — le nom « Président » ne garantit pas un comportement système particulier, ce n'est qu'un rôle comme un autre)
- **RF-08** : Chaque rôle porte un ensemble de droits, définis par couple (module, niveau). Modules : Événements, Finances, Membres, Cartographie, Hauts faits. Niveaux : Lecture, Écriture
- **RF-09** : Un membre peut cumuler plusieurs rôles au sein d'une même association. **Décision** : conservé tel quel — c'est la pratique la plus fidèle au fonctionnement réel des associations (ex. un Trésorier est souvent aussi Membre du CA). Les droits effectifs d'un membre sont l'**union** des droits de tous ses rôles cumulés (le niveau le plus permissif l'emporte en cas de conflit Lecture/Écriture sur un même module)
- **RF-10** : Un utilisateur peut rejoindre librement une association. **Décision** : adhésion libre par défaut pour le MVP (réduit la friction d'onboarding), avec un paramètre `adhesionSurValidation: boolean` par association permettant à l'Admin de basculer en mode "validation manuelle requise" — le champ est prévu dès le modèle de données mais son activation/UI de validation peut être livrée en V2

### 3.3 Événements
- **RF-11** : Un Admin (disposant du droit Écriture sur le module Événements) peut créer, modifier, supprimer un événement
- **RF-12** : Tout utilisateur peut consulter la liste des événements et leur détail. **Décision** : visibilité publique par défaut (favorise la découverte et le recrutement, cohérent avec un objectif associatif), avec un attribut `visibilite: PUBLIC | MEMBRES` par événement permettant à l'Admin de restreindre un événement sensible aux seuls membres de l'association
- **RF-13** : Un utilisateur peut s'inscrire à un événement ; l'inscription passe par un statut `EN_ATTENTE` jusqu'à validation par un Admin
- **RF-14** : Si l'événement requiert un costume, l'utilisateur soumet un dossier costume (civil/militaire) avec pièce(s) justificative(s)
- **RF-15** : L'Admin valide ou refuse un dossier costume. En cas de refus, il **doit** renseigner un motif
- **RF-16** : En cas de refus, l'utilisateur peut répondre au motif. **Décision** : modélisé comme un **mini-fil de messages horodatés** (et non un message unique figé), sur le modèle d'un ticket de support — chaque réponse de l'utilisateur repasse le statut à `EN_ATTENTE` jusqu'à ce que l'Admin valide ou refuse à nouveau (avec un nouveau motif si refus). C'est plus robuste qu'un aller-retour unique : ça couvre nativement les échanges à plusieurs itérations sans modification de modèle ultérieure
- **RF-17** : Lorsqu'une inscription est validée, le système attribue automatiquement le haut fait "Participation à l'événement" s'il existe pour l'association concernée

### 3.4 Outils de gestion d'événement (Admin)
- **RF-18** : Tableau Kanban de tâches par événement, colonnes : À faire / En cours / Terminé
- **RF-19** : Une tâche peut être assignée à un membre de l'association
- **RF-20** : Cartographie : création d'un plan (upload d'un fond de carte ou création vierge) et positionnement d'éléments (tentes, stands, zones) avec libellé et coordonnées

### 3.5 Hauts faits
- **RF-21** : Un Admin crée des hauts faits rattachés à son association (nom, description, icône)
- **RF-22** : Un Admin peut assigner directement un haut fait à un utilisateur, sans passer par une réclamation
- **RF-23** : Tout utilisateur peut consulter la liste des hauts faits d'une association et leur statut pour lui-même
- **RF-24** : Un utilisateur peut réclamer un haut fait ; la demande passe en `EN_ATTENTE`
- **RF-25** : Un Admin valide ou refuse une réclamation. En cas de refus, motif obligatoire, et l'utilisateur peut y répondre via le même mécanisme de fil de messages que RF-16 (cohérence UX entre les deux circuits de refus/réponse)
- **RF-26** : Le haut fait "Participation à l'événement" est attribué automatiquement par le système, hors circuit de réclamation. **Décision sur la cumulabilité** (point ouvert n°6) : par défaut un haut fait est **non cumulable** (un utilisateur ne peut l'obtenir qu'une fois), sauf s'il porte l'attribut `cumulable: boolean = true` défini à sa création par l'Admin. Le haut fait "Participation à l'événement" est marqué `cumulable = true` par défaut, puisqu'il a vocation à être ré-attribué à chaque nouvel événement — c'est la pratique standard des systèmes de badges/achievements (badges uniques par défaut, exceptions explicites pour les badges répétables)

---

## 4. Règles de gestion transverses

- **RG-01** : Les droits (Lecture/Écriture) sont vérifiés par module à chaque action sensible (ex. Écriture sur Événements requise pour créer un événement)
- **RG-02** : Le créateur d'une association ne peut pas quitter ou être rétrogradé de son rôle d'Admin sans qu'un autre membre soit promu Admin au préalable. **Décision** : règle conservée et actée — c'est une garde-fou standard pour éviter une association orpheline (sans aucun compte disposant des droits d'administration)
- **RG-03** : Un motif de refus (dossier costume ou réclamation de haut fait) est obligatoire côté Admin dès lors que le statut passe à `REFUSE`
- **RG-04** : L'attribution automatique de haut fait (RF-17) ne déclenche pas de notification de réclamation ; elle est directe et journalisée avec `modeObtention = AUTOMATIQUE`

---

## 5. Exigences non fonctionnelles

| Catégorie | Exigence |
|---|---|
| Sécurité | Authentification déléguée à OAuth (pas de gestion de mot de passe en interne) ; jetons de session (JWT ou session serveur) avec expiration |
| Sécurité | Contrôle d'accès systématique côté API (pas seulement côté front) sur chaque endpoint, basé sur les droits par module |
| RGPD | Minimisation des données collectées via OAuth ; procédure de suppression/anonymisation de compte |
| Disponibilité | Hébergement mono-instance acceptable pour le MVP (pas de HA exigée à ce stade) |
| Performance | Liste d'événements paginée ; pas de contrainte de charge forte anticipée au MVP |
| Fichiers | Stockage des pièces jointes (dossiers costume, icônes de hauts faits, fonds de carte) en dehors de la base de données (stockage objet) |
| Portabilité | Architecture conteneurisée (Docker) pour déploiement sur infrastructure Proxmox existante |

---

## 6. Architecture technique

**Décision (point ouvert n°7)** : stack **Node.js / NestJS**, retenue plutôt que Symfony/API Platform pour ce projet précis, pour trois raisons :
- Les fonctionnalités les plus interactives de l'appli — Kanban en glisser-déposer, cartographie avec positionnement d'éléments — bénéficient d'un écosystème JS unifié front/back (types partagés, WebSocket natif via Socket.io pour du temps réel sur le Kanban si besoin en V2)
- Passport.js couvre nativement les stratégies OAuth Google et Discord avec un minimum de configuration
- NestJS reproduit une structure modulaire proche du DDD (modules, guards, providers), donc pas de perte de rigueur architecturale par rapport à Symfony

Symfony/API Platform reste un choix tout aussi valide si le projet doit s'intégrer à un écosystème PHP existant — à reconsidérer uniquement si c'est le cas.

### Stack retenue
- **Backend** : Node.js + NestJS, architecture modulaire par domaine (Auth, Utilisateurs, Associations, Événements, HautsFaits)
- **ORM** : Prisma (migrations versionnées, typage fort aligné avec TypeScript)
- **Base de données** : PostgreSQL
- **Authentification** : Passport.js (stratégies `passport-google-oauth20`, `passport-discord`), émission de JWT côté backend, refresh token en cookie httpOnly
- **Frontend** : React + Tailwind (Vite)
- **Stockage fichiers** : S3-compatible (MinIO, auto-hébergeable sur ton infrastructure Proxmox existante) pour les dossiers costume, icônes de hauts faits, fonds de carte
- **Conteneurisation** : Docker Compose pour le dev ; déploiement K3s en prod, cohérent avec ton infra Proxmox déjà en place
- **CI/CD** : pipeline de build/test/déploiement (GitHub Actions ou Jenkins selon l'hébergement du dépôt)

---

## 7. Modèle de données

Voir le diagramme de classes détaillé fourni précédemment (`ClassDiagram_PlateformeEvenementielle`), couvrant :
- Compte (`Utilisateur`)
- Association, `MembreAssociation`, `Role`, `Droit`
- `Evenement`, `Inscription`, `DossierCostume` (avec `motifRefus` / `reponseUtilisateur`)
- `Tache` (Kanban)
- `Cartographie`, `ElementCarte`
- `HautFait`, `ReclamationHautFait` (avec `motifRefus` / `reponseUtilisateur`), `HautFaitObtenu`

---

## 8. API — Ressources principales (aperçu)

| Ressource | Endpoints principaux |
|---|---|
| Auth | `GET /auth/{provider}`, `GET /auth/{provider}/callback`, `POST /auth/logout` |
| Utilisateurs | `GET /me`, `PATCH /me`, `DELETE /me` |
| Associations | `GET /associations`, `POST /associations`, `PATCH /associations/{id}`, `DELETE /associations/{id}` |
| Membres/Rôles | `GET /associations/{id}/membres`, `POST /associations/{id}/membres/{userId}/roles`, `POST /associations/{id}/roles`, `PATCH /roles/{id}` |
| Événements | `GET /evenements`, `GET /evenements/{id}`, `POST /associations/{id}/evenements`, `PATCH /evenements/{id}` |
| Inscriptions | `POST /evenements/{id}/inscriptions`, `PATCH /inscriptions/{id}` (validation) |
| Dossiers costume | `POST /inscriptions/{id}/dossier`, `PATCH /dossiers/{id}` (validation/refus + motif), `POST /dossiers/{id}/reponse` |
| Tâches | `GET /evenements/{id}/taches`, `POST /evenements/{id}/taches`, `PATCH /taches/{id}` |
| Cartographie | `GET/POST /evenements/{id}/cartographie`, `POST /cartographies/{id}/elements` |
| Hauts faits | `GET /associations/{id}/hauts-faits`, `POST /associations/{id}/hauts-faits`, `POST /hauts-faits/{id}/reclamer`, `PATCH /reclamations/{id}` (validation/refus + motif), `POST /reclamations/{id}/reponse` |

*(Liste non exhaustive, à affiner lors du passage en spécification technique détaillée par ressource.)*

---

## 9. Décisions actées

Tous les points initialement ouverts ont été tranchés et intégrés dans les sections correspondantes ; récapitulatif :

| # | Sujet | Décision | Réf. |
|---|---|---|---|
| 1 | Comptes multi-provider | Pas de fusion automatique par email ; comptes distincts, liaison manuelle possible en V2 | RF-02 |
| 2 | Visibilité des événements | Publics par défaut, restriction "membres" configurable par événement | RF-12 |
| 3 | Adhésion à une association | Libre par défaut, validation manuelle activable par l'Admin | RF-10 |
| 4 | Cumul de rôles | Autorisé, droits = union des rôles cumulés | RF-09 |
| 5 | Réponse à un refus | Fil de messages horodatés, pas un aller-retour unique | RF-16, RF-25 |
| 6 | Haut fait cumulable | Non cumulable par défaut, sauf attribut explicite (le badge "Participation" est cumulable) | RF-26 |
| 7 | Stack technique | Node.js / NestJS + PostgreSQL + Prisma + React | Section 6 |

Ces décisions engagent la conception mais restent réversibles avant le début du développement — à relire une dernière fois avant de passer à la spécification API détaillée (OpenAPI/Swagger).

---

## 10. Livrables associés

- `use_cases_plateforme.puml` / `.md` — cas d'utilisation détaillés
- Diagramme de classes — modèle de données détaillé
- Le présent document — cahier des charges fonctionnel et technique
