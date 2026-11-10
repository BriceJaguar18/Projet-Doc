# Cahier de recette — à faire avant la livraison

Cochez chaque ligne. Si quelque chose ne se passe pas comme prévu, notez ce que vous avez fait et ce que vous avez
vu, puis transmettez-le à Claude.

Il y a deux niveaux de test :

| | Niveau A — Démo | Niveau B — Test réel |
|---|---|---|
| Ce qu'il faut | Un ordinateur (ou une tablette) | Firebase + Netlify configurés (voir [GUIDE-INSTALLATION](GUIDE-INSTALLATION.md)) et **2 appareils** |
| Durée | 30 min | 30 min |
| Ce que ça vérifie | Toutes les fonctions et l'ergonomie | La vraie synchronisation entre deux tablettes, les mots de passe, les coupures internet |

> En démo, les deux écrans ne se synchronisent qu'entre deux onglets **du même appareil**. Pour tester avec deux
> appareils différents, il faut le niveau B.

---

## Niveau A — Démo

**Préparation :** ouvrez le lien de démo dans **deux fenêtres côte à côte**. Dans la première, touchez
« Tablette Service », dans la seconde « Tablette Cuisine ». Dans l'une des deux, vous pouvez d'abord toucher
« Ajouter des commandes d'exemple ».

### Prise de commande (Service)
- [ ] « + Nouvelle commande » : saisir un nom, choisir l'origine « Téléphone ».
- [ ] Choisir un créneau ; essayer :05 et « Autre heure ».
- [ ] Ajouter une Reine **Grande**, base **Crème**, **+ Chèvre**, **− Champignons**, **Non coupée**, **Sans olives**.
- [ ] Ajouter une Margherita **Petite**, la dupliquer (⧉ ×2), supprimer le doublon (✕).
- [ ] Ajouter 2 boissons et 1 dessert.
- [ ] Enregistrer : la commande apparaît à l'heure choisie, dans l'ordre des heures de retrait.
- [ ] Essayer d'enregistrer sans nom ou sans produit : un message explique ce qui manque.

### Cuisine
- [ ] La commande apparaît **tout de suite** côté Cuisine, dans la colonne de son créneau, avec « NOUVELLE ».
- [ ] Les détails sont tous visibles : taille, base, + / −, NON COUPÉE, SANS OLIVES.
- [ ] Pas de boissons ni de desserts côté Cuisine, et aucun bouton « Payée » ou « Prête ».
- [ ] « Lancer préparation » → la ligne devient **jaune** côté Service.
- [ ] « Au four » → **bleue** côté Service.
- [ ] « ↩ Retour préparation » → redevient **jaune** ; « ↩ Annuler » → redevient **neutre**.
- [ ] Une commande de 2 pizzas en attente propose « Tout lancer », puis « Tout au four ».
- [ ] Le bip sonne à l'arrivée d'une nouvelle commande (après avoir touché l'écran une première fois).

### Validation et retrait (Service)
- [ ] « Prête ✓ » apparaît seulement sur une pizza **au four** → la ligne devient **verte**.
- [ ] Quand toutes les pizzas sont prêtes, la commande **disparaît** de l'écran Cuisine.
- [ ] « Payée ? » → les noms des pizzas sont **barrés**. Retoucher → plus barrés.
- [ ] « Récupérée ? » sur une commande non payée → une confirmation est demandée.
- [ ] Une fois récupérée, la carte devient **rose** et passe dans l'onglet « Récupérées ».
- [ ] « ✎ Modifier » sur une commande déjà au four : changer l'heure, ajouter une pizza → la pizza au four reste
      **bleue**, la nouvelle est neutre.
- [ ] 🗑 supprime la commande (après confirmation), sur les deux écrans.

### Planning, capacité et report sur le créneau suivant
- [ ] Le bandeau du haut affiche `x/5` (toutes tailles) qui augmente quand on ajoute des pizzas, grandes ou petites.
- [ ] Mettre 4 pizzas sur un créneau, puis une commande de 3 pizzas sur le même créneau → message orange :
      1 pizza reste, 2 passent sur le créneau suivant, avec la nouvelle heure de retrait.
- [ ] « Enregistrer (retrait …) » → la carte affiche la nouvelle heure en gros et « demandé … » à côté ; les pizzas
      reportées ont un badge orange « créneau … ».
- [ ] Côté Cuisine, cette commande apparaît dans les deux colonnes, chacune avec ses pizzas.
- [ ] Sur un créneau complet, « Forcer tout sur … » garde toutes les pizzas sur ce créneau (case rouge dans le
      bandeau).
- [ ] Toucher un créneau dans le bandeau, passer le maximum à 7 → le maximum change aussi côté Cuisine.
- [ ] « Revenir au défaut » remet le maximum par défaut.

### Prix et total
- [ ] Dans le formulaire, chaque pizza affiche son prix (suppléments compris) et le total se met à jour en bas.
- [ ] Une « Autre pizza » demande un prix ; il est bien compté dans le total.
- [ ] Le total apparaît en bas à droite de chaque carte commande.
- [ ] Changer le prix d'une pizza dans les Réglages → les nouvelles commandes ont le nouveau prix, les anciennes
      gardent l'ancien.

### Ventes (📊)
- [ ] Le total des ventes correspond à la somme des totaux des commandes du jour.
- [ ] Les articles vendus sont listés avec quantité, prix unitaire et total (pizzas par taille, suppléments,
      boissons, kiosquitos, desserts).
- [ ] Les boutons Midi / Soir ne gardent que les commandes de ce service.
- [ ] « Télécharger le récapitulatif » → le fichier arrive dans Téléchargements et s'ouvre correctement dans
      Excel ou Google Sheets (accents, montants).
- [ ] Choisir le jour d'hier → les ventes d'hier s'affichent (niveau B uniquement).

### Alertes de retard
- [ ] Créer une commande pour **dans 5 minutes** sans la lancer → badge orange « À lancer » sur les deux écrans.
- [ ] Attendre que l'heure soit passée → cadre **rouge clignotant** « RETARD +N min » et compteur « en retard »
      en haut de l'écran Service.
- [ ] Quand toutes ses pizzas sont prêtes, l'alerte disparaît.

### Réglages (⚙ côté Service)
- [ ] Ajouter une pizza à la carte avec ses ingrédients → elle apparaît dans le formulaire, et ses ingrédients
      dans « Retirer ».
- [ ] Ajouter un supplément, une boisson (avec leur prix), une origine (ex. « Deliveroo »).
- [ ] Changer le maximum par créneau, les horaires, le délai de pré-alerte, Coupée/Olives par défaut.
- [ ] « ← Retour » sans enregistrer → une confirmation est demandée.

### Lisibilité
- [ ] Sur une tablette tenue **à l'horizontale**, à 1 m de distance, l'écran Cuisine se lit sans effort.
- [ ] Tous les boutons se touchent facilement avec un doigt (même avec des mains farinées).

---

## Niveau B — Test réel (avant de livrer)

**Préparation :** suivez le [guide d'installation](GUIDE-INSTALLATION.md) (Firebase, configuration, Netlify).
Vous pouvez utiliser **directement le projet Firebase du client** ou un projet de test à votre nom.
Prenez **deux appareils différents** : idéalement les deux vraies tablettes, sinon un téléphone et un ordinateur.

### Connexion
- [ ] Le bandeau violet « MODE DÉMO » n'apparaît **plus**.
- [ ] Un mauvais mot de passe affiche « Mot de passe incorrect ».
- [ ] Chaque appareil se connecte avec son compte et arrive sur le bon écran.
- [ ] Après fermeture de l'application ou redémarrage, l'appareil reste connecté.
- [ ] En haut de l'écran, l'état affiche « Synchronisé ».

### Synchronisation entre les deux appareils
- [ ] Refaire rapidement le parcours du niveau A (commande → préparation → four → prête → payée → récupérée) :
      chaque action apparaît sur l'autre appareil en **1 à 2 secondes**.
- [ ] Les réglages modifiés (carte, quotas) apparaissent sur l'autre appareil.
- [ ] Recharger la page : les commandes du jour sont toujours là.

### Coupure internet
- [ ] Couper le Wi-Fi de la tablette Cuisine → bandeau rouge « Pas d'internet ».
- [ ] Pendant la coupure, lancer une préparation côté Cuisine : la tablette Service ne la voit pas encore.
- [ ] Remettre le Wi-Fi → dans les secondes qui suivent, la tablette Service passe en jaune et le bandeau disparaît.

### Sur place, avant de livrer
- [ ] Remplacer la carte d'exemple par **la vraie carte** du kiosque, ainsi que les suppléments, boissons,
      Kiosquitos et desserts.
- [ ] Saisir **les vrais prix** de chaque article.
- [ ] Régler les **vrais horaires** d'ouverture et le **maximum de pizzas par créneau** avec le gérant.
- [ ] Faire un export des ventes depuis la vraie tablette et vérifier où se trouve le fichier.
- [ ] Vérifier la **date et l'heure automatiques** sur les deux tablettes.
- [ ] Supprimer les commandes de test (🗑) pour que le client démarre avec une liste vide.
- [ ] Remettre au client les deux mots de passe et le [mode d'emploi](GUIDE-UTILISATION.md).
