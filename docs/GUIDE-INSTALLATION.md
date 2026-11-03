# Guide d'installation — Kiosque à Pizzas de Frouzins

Ce guide s'adresse à quelqu'un qui n'est **pas informaticien**. Comptez environ **45 minutes** la première fois.
Tout est **gratuit** (offres gratuites de Firebase et Netlify, largement suffisantes pour un kiosque).

## Vue d'ensemble

```
 Tablette SERVICE ─┐                        ┌─ Firebase  : la base de données qui synchronise les 2 tablettes
                   ├──── internet ──────────┤
 Tablette CUISINE ─┘                        └─ Netlify   : l'adresse web où se trouve l'application
```

Il y a 4 étapes :

1. **Firebase** : créer la base de données et les 2 comptes des tablettes (≈ 20 min)
2. **Transmettre la configuration** pour qu'elle soit ajoutée au code (≈ 2 min)
3. **Netlify** : mettre l'application en ligne (≈ 10 min)
4. **Les tablettes** : ouvrir l'application et se connecter (≈ 10 min)

> 💡 Conseil : créez un **compte Google dédié au kiosque** (ex. `kiosque.frouzins@gmail.com`) plutôt que d'utiliser
> un compte personnel. Notez tous les mots de passe dans un endroit sûr.

Les menus de Firebase et Netlify changent parfois de nom ou de place : si un bouton n'est pas exactement là où
le guide l'indique, cherchez un intitulé proche.

---

## Étape 1 — Firebase (base de données)

### 1.1 Créer le projet

1. Allez sur **https://console.firebase.google.com** et connectez-vous avec le compte Google du kiosque.
2. Cliquez sur **« Créer un projet »**.
3. Nom du projet : `kiosque-frouzins` → **Continuer**.
4. Google Analytics : **désactivez-le** (inutile ici) → **Créer le projet**. Attendez puis **Continuer**.

### 1.2 Créer la base de données Firestore

1. Dans le menu de gauche : **Créer (Build) → Firestore Database**.
2. **Créer une base de données**.
3. Édition : **Standard**. Emplacement : **`europe-west9 (Paris)`** → **Suivant**.
   ⚠️ L'emplacement ne peut plus être changé ensuite.
4. Choisissez **« Démarrer en mode production »** → **Créer**.

### 1.3 Coller les règles de sécurité

Ces règles garantissent que seules les 2 tablettes du kiosque peuvent lire et modifier les commandes.

1. Toujours dans Firestore Database, ouvrez l'onglet **« Règles »**.
2. **Effacez tout** le texte présent.
3. Ouvrez le fichier [`firestore.rules`](../firestore.rules) de ce projet (sur GitHub : cliquez dessus, puis sur
   l'icône « Copier »), et **collez** son contenu.
4. Cliquez sur **« Publier »**.

### 1.4 Activer la connexion par mot de passe

1. Menu de gauche : **Créer (Build) → Authentication** → **Commencer**.
2. Onglet **« Méthode de connexion »** → **E-mail/Mot de passe**.
3. Activez **seulement le premier interrupteur** (« E-mail/Mot de passe ») → **Enregistrer**.

### 1.5 Créer les 2 comptes des tablettes

1. Onglet **« Utilisateurs »** → **Ajouter un utilisateur**.
2. Créez ces deux comptes **en recopiant exactement les adresses** :

   | Tablette | Adresse e-mail (identifiant)    | Mot de passe                       |
   |----------|---------------------------------|------------------------------------|
   | Service  | `service@kiosque-frouzins.fr`   | au choix (8 caractères minimum)    |
   | Cuisine  | `cuisine@kiosque-frouzins.fr`   | au choix (8 caractères minimum)    |

   Ces adresses servent seulement d'identifiant : aucun e-mail n'y est jamais envoyé.
3. **Notez les deux mots de passe** : ils seront demandés une seule fois sur chaque tablette.

### 1.6 Interdire la création d'autres comptes

1. Toujours dans Authentication, onglet **« Paramètres »** → **« Actions des utilisateurs »**.
2. **Décochez « Activer la création (inscription) »** → **Enregistrer**.

Ainsi, personne ne peut se créer un compte de son côté.

### 1.7 Récupérer la « configuration web »

1. Cliquez sur la **roue dentée ⚙** (en haut à gauche) → **Paramètres du projet**.
2. Dans l'onglet **Général**, descendez jusqu'à **« Vos applications »** et cliquez sur l'icône **`</>`** (Web).
3. Surnom de l'application : `kiosque`. **Ne cochez pas** « Firebase Hosting ». → **Enregistrer l'application**.
4. Firebase affiche un bloc de code qui ressemble à ceci :

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "kiosque-frouzins.firebaseapp.com",
     projectId: "kiosque-frouzins",
     storageBucket: "kiosque-frouzins.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef..."
   };
   ```

   **Copiez ces lignes.** Elles ne sont pas secrètes (la sécurité vient des comptes et des règles).

---

## Étape 2 — Ajouter la configuration au code

**Le plus simple :** envoyez le bloc copié à Claude en disant « voici la config Firebase », il l'ajoute au code.

**Ou vous-même, sur GitHub :**

1. Ouvrez le dépôt sur github.com → fichier `src/config/firebase-config.ts` → icône **crayon ✏️** (Modifier).
2. Remplissez les valeurs entre les guillemets `''` avec celles de Firebase.
3. **Commit changes…** → **Commit changes**.

Tant que cette configuration est vide, l'application fonctionne en **MODE DÉMO** (bandeau violet en haut) :
les deux tablettes ne seraient **pas** synchronisées entre elles.

---

## Étape 3 — Netlify (mettre l'application en ligne)

1. Allez sur **https://app.netlify.com** → **Sign up** → **« Sign up with GitHub »** (avec le compte GitHub qui
   contient ce projet).
2. **Add new project → Import an existing project → GitHub**. Autorisez Netlify si on vous le demande.
3. Choisissez le dépôt **Projet-Doc**.
4. Netlify lit tout seul les réglages (fichier `netlify.toml`) : ne changez rien, cliquez sur **Deploy**.
5. Attendez 1 à 2 minutes : l'état passe à **« Published »**.
6. Pour une adresse lisible : **Project configuration → Change project name** → `kiosque-frouzins`.
   L'application est alors sur **https://kiosque-frouzins.netlify.app** (si le nom est libre).

À chaque modification du code sur GitHub, Netlify republie automatiquement l'application (≈ 1 min).

### 3.1 Autoriser l'adresse dans Firebase

Dans Firebase : **Authentication → Paramètres → Domaines autorisés → Ajouter un domaine** →
`kiosque-frouzins.netlify.app` (l'adresse obtenue ci-dessus, sans `https://`).

---

## Étape 4 — Les tablettes

### Matériel conseillé

- **2 tablettes de 10 à 11 pouces** (Android, ex. Samsung Galaxy Tab A9+, ou iPad), utilisées **à l'horizontale**.
- Côté cuisine : **coque de protection** et **support mural**, loin de la chaleur du four, branchée en permanence.
- Une **connexion internet fiable**. Idéalement une box avec **secours 4G** (ou garder un téléphone prêt à partager
  sa connexion) : si internet coupe, chaque tablette continue de fonctionner, mais elles ne se voient plus
  jusqu'au retour de la connexion.

### Réglages de chaque tablette

1. **Date et heure automatiques** (Paramètres → Date et heure) : les alertes de retard en dépendent.
2. Mise en veille de l'écran : **la plus longue possible** (l'application garde aussi l'écran allumé).
3. Ouvrez **Chrome** (Android) ou **Safari** (iPad) à l'adresse de l'application.
4. Installez-la en plein écran :
   - Android/Chrome : menu **⋮ → « Ajouter à l'écran d'accueil »** (ou « Installer l'application »).
   - iPad/Safari : bouton **Partager → « Sur l'écran d'accueil »**.
5. Ouvrez l'application depuis la nouvelle icône 🍕, touchez **« Tablette Service »** ou **« Tablette Cuisine »**,
   tapez le mot de passe correspondant → **Se connecter**.

La tablette reste connectée ensuite (même après redémarrage).

**Option « borne » (Android) :** l'application *Fully Kiosk Browser* verrouille la tablette sur l'application
(adresse de départ = celle de Netlify, « Keep screen on », « Launch on boot »). Sur iPad : *Accès guidé*
(Réglages → Accessibilité).

---

## Questions fréquentes

**Combien ça coûte ?**
Rien avec les offres gratuites. Pour un kiosque (≈ 150 commandes/jour), l'usage reste très en dessous des limites
gratuites de Firebase (50 000 lectures et 20 000 écritures par jour) et de Netlify.

**Comment changer la carte, les quotas, les horaires ?**
Directement sur la tablette Service : bouton **⚙ Réglages**. Aucun code à toucher.

**Comment changer un mot de passe de tablette ?**
Firebase → Authentication → Utilisateurs → **supprimer** le compte, puis le **recréer** avec la même adresse et
le nouveau mot de passe. Reconnectez ensuite la tablette (Réglages → « Déconnecter la tablette » côté Service,
bouton ⏏ côté Cuisine).

**Une tablette est perdue ou volée ?**
Supprimez puis recréez son compte comme ci-dessus : elle sera déconnectée dans l'heure qui suit.

**Où sont les données ?**
Dans Firestore, à Paris. Seuls le nom du client et la commande sont enregistrés (ni téléphone ni paiement).
Les commandes des jours précédents sont conservées et consultables dans la console Firebase.
