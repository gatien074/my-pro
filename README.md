# Caisse & Stock — gestion pour petits commerces du Gabon

Application web **100 % hors ligne**, en français, pensée pour les boutiques, quincailleries, pharmacies, restaurants et « alimentations » de Libreville, Port-Gentil, Franceville. Elle remplace le cahier du commerçant :

- **Caisse** : ventes en quelques secondes, espèces / Airtel Money / Moov Money / crédit, ticket 80 mm imprimable, rendu automatique, annulation d'une vente directement depuis le ticket (stock restitué, mouvement tracé).
- **Stock** : alertes avant rupture, mouvements tracés (ventes, entrées, pertes, inventaire), valeur du stock.
- **Dettes clients** : ventes à crédit, acomptes, remboursements partiels, retards, **relance WhatsApp et appel** en un clic.
- **Rapports** : chiffre d'affaires, **bénéfice réel**, panier moyen, marge, produits qui se vendent, modes de paiement, dettes, et **journal des ventes** (recherche, réimpression du ticket, annulation) ; export CSV et impression.
- **Profils** : gérant (tout) et caissier (caisse, produits, clients), code PIN en option.

## Fonctionnement

Tout est stocké **localement dans le navigateur** (IndexedDB), aucune connexion Internet n'est nécessaire après le premier chargement. L'application s'installe comme une app (PWA) sur téléphone, tablette ou PC.

> ⚠️ Sauvegardez régulièrement : `Paramètres → Données & sauvegarde → Exporter une sauvegarde` (fichier JSON). Une restauration remplace toutes les données actuelles.

### Données de démonstration

À la première ouverture, vous pouvez charger un catalogue « Alimentation Chez Nzamba » avec 30 jours de ventes et des clients endettés, pour tester immédiatement. Codes PIN de la démo : **1234** (gérant) et **4321** (caissière). Vous pourrez tout remplacer dans les onglets Produits / Clients, ou effacer via `Paramètres → Zone dangereuse`.

## Démarrage (développeur)

```bash
npm install
npm run dev       # serveur de développement → http://localhost:5173
npm run test      # tests unitaires des calculs (bénéfices, dettes, montants)
npm run build     # vérification TypeScript + build de production dans dist/
npm run preview   # sert le build de production en local
```

Note Windows : exécuter `npm.cmd` si PowerShell bloque `npm.ps1`.

## Mise en production

copie le dossier `dist/` sur n'importe quel hébergement statique (Netlify, Vercel, GitHub Pages, Cloudflare Pages…) — aucun serveur ni base de données à gérer. Ouvrez ensuite l'URL sur l'appareil du commerce puis « Installer l'application » depuis le navigateur pour un usage hors ligne.

## Limites connues (v1)

- **Un seul appareil** : pas de synchronisation multi-téléphones (transfert possible par sauvegarde JSON importée).
- **Le PIN est un verrou simple**, pas un chiffrement : quelqu'un maîtrisant l'appareil peut forcer l'accès aux données.
- Impression thermique 80 mm via la boîte d'impression du navigateur (RawBT ou Gaberit peut être requis sur certains Android).
- Pas de scan par caméra (les lecteurs USB/Bluetooth qui « tapent » comme un clavier sont déjà pris en charge).

## Structure du code

```
src/
  db/       schéma Dexie, opérations métier (ventes, stock, dettes), données de démo, sauvegarde
  lib/      monnaie FCFA, dates, calculs (bénéfice, dettes), CSV, WhatsApp, PIN
  store/    état session (PIN) et panier
  components/ bibliothèque UI, layout, boîte de paiement, ticket
  pages/    Onboarding, Connexion, Caisse, Produits, Stock, Clients, ClientDetail, Rapports, Paramètres
  styles/   jetons de design (palette, polices, styles de composants)
public/fonts/ polices auto-hébergées (Space Grotesk, IBM Plex Sans), précachées pour le hors ligne
```

## Identité visuelle

Direction « Le Comptoir » : les trois bandes du drapeau gabonais (vert forêt, or, bleu
Atlantique) servent de signature ; un cadre vert sombre encadre la zone de travail claire.
Titres et montants en **Space Grotesk**, texte et tableaux en **IBM Plex Sans**. La palette,
les polices et les styles de base sont centralisés dans `src/styles/index.css`.

## Feuille de route pressentie

- Clôture de caisse (fond de caisse, écart espèces) et journal de caisse.
- Synchronisation multi-appareils (serveur optionnel).
- Recettes / ingrédients pour restaurants.
- Scan par caméra (BarcodeDetector).
