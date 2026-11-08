# Correctif — Zone connectée figée : le cookie de session démo piégeait les navigateurs (2026-11-07, soir)

## Symptôme

Sur le téléphone du fondateur (et reproduit par un navigateur de contrôle) :
dans l'espace connecté, les boutons ne répondaient plus — déconnexion
inefficace (retour immédiat au tableau de bord, effet de « tremblement »),
connexion impossible (la page de connexion renvoyait au tableau de bord),
parc affiché vide. Les pages publiques fonctionnaient parfaitement.
Le fondateur avait utilisé la console sans problème le même jour vers
17 h 30 ; le piège s'est déclenché à sa première déconnexion (tests
d'échange de compte avec le compte cliente approuvé).

## Cause racine (démontrée dans le code)

Le site a tourné en **mode démo** le 2026-11-06 au soir, avant le
branchement de Supabase (~23 h 17). Pendant cette période,
`DemoProvider.signIn` pose le cookie `cizaimmo-demo-session=1` avec
**max-age = 30 jours** (`lib/data/demo.ts`). Tout navigateur ayant
cliqué un bouton démo ce soir-là porte encore ce cookie.

Deux défauts se combinaient :

1. **Le middleware honorait ce cookie dans tous les modes**
   (`middleware.ts`) : `hasDemoSession` → `authenticated = true`,
   en court-circuitant même la vérification de la session Supabase.
2. **`RealProvider.signOut` n'effaçait pas ce cookie** — seul
   `DemoProvider.signOut` le faisait, et il ne sert jamais en mode réel.

Mécanisme : déconnexion réelle → la session Supabase est effacée →
navigation vers `/connexion` → le middleware voit le cookie démo →
« authentifié » → **renvoi forcé au tableau de bord**, où
`getSession()` vaut `null` : aucune donnée, boutons sans effet,
pages d'authentification inaccessibles (rebond). Les pages publiques,
non protégées par le middleware, restaient saines. Avec une session
réelle active, tout fonctionnait — d'où l'apparition tardive.

Ce défaut n'a été introduit par **aucun** des commits du 2026-11-07
(middleware et pose du cookie inchangés dans la fenêtre) : c'est un
défaut de conception préexistant, déclenché par la première
déconnexion dans un navigateur porteur du cookie démo.

## Correctif (2 points, chirurgical)

- **`middleware.ts`** : le cookie démo n'authentifie QUE si le site
  tourne réellement en mode démo (`isDemoMode()`). En mode réel, il
  est ignoré ; la session Supabase redevient la seule référence.
- **`lib/data/real.ts`** : `RealProvider.signOut` efface aussi le
  cookie de session démo résiduel (défense en profondeur ; nettoie
  les navigateurs déjà porteurs).

Le mode démo (déploiement sans Supabase) est inchangé : le cookie y
reste honoré, posé et effacé par le DemoProvider comme avant.

Effet pour les navigateurs déjà piégés : dès le déploiement, le
middleware ignore le cookie — la page de connexion redevient
accessible et la connexion/déconnexion refonctionnent, sans aucune
action de l'utilisateur.

## Preuves

- Nouveau contrôle ciblé `scripts/test-correctif-cookie-demo.cjs`
  (branché dans `scripts/run-tests.sh`) : vérification statique du
  mécanisme + table de décision. **Échoue sur le code fautif**
  (3 KO : garde `isDemoMode()` absente, import absent, signOut sans
  effacement) et **passe sur le code corrigé** (12 OK, 0 KO).
- Suite complète `bash scripts/run-tests.sh` : verte
  (« Tous les tests demandés sont passés »).
- `npm run build` : OK (middleware compilé).

Aucun SQL requis.
