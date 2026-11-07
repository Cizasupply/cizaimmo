# Renfort — Suppression de compte : confirmation par mot de passe (2026-11-07)

## Demande du fondateur

La suppression de compte par le client (v1.5) ne doit plus reposer
sur le seul dialogue de confirmation : **avant que la demande soit
enregistrée, le client saisit le mot de passe de son compte et il
est vérifié**. Un mot de passe faux ne doit rien changer.

## Implémentation

- **Dialogue partagé** `components/SuppressionCompteDialog.tsx`,
  utilisé par les DEUX points d'entrée (Paramètres → « Supprimer
  mon compte » et page Abonnement, qui affichaient chacun leur
  `ConfirmDialog`) : champ mot de passe obligatoire
  (`type="password"`, `autoComplete="current-password"`), texte
  d'explication (clé v15 `deletionPasswordText`), bouton de
  confirmation désactivé tant que le champ est vide.
- **Vérification dans le provider** — la signature devient
  `demanderSuppressionCompte(motDePasse: string)`, ce qui garantit
  l'ordre **vérification → RPC** partout :
  - Réel (`lib/data/real.ts`) : ré-authentification Supabase Auth,
    `auth.signInWithPassword({ email: session.email, password })`
    (e-mail de l'utilisateur connecté ; la session reste la sienne).
    Échec ou mot de passe vide → `ERR_MOT_DE_PASSE_INCORRECT`,
    **aucun appel** à la RPC `demander_suppression_compte`, aucun
    changement d'état.
  - Démo (`lib/data/demo.ts`) : la démo n'a pas de mots de passe
    réels (la connexion démo accepte n'importe quel mot de passe) —
    la garde cohérente exige un mot de passe non vide, sinon le
    même `ERR_MOT_DE_PASSE_INCORRECT`, avant tout changement d'état.
- **Erreur dans le dialogue** : `ERR_MOT_DE_PASSE_INCORRECT` est
  affichée sous le champ mot de passe (clé
  `v15.errors.ERR_MOT_DE_PASSE_INCORRECT`, FR + EN), le dialogue
  reste ouvert, le champ est vidé. Les autres erreurs gardent le
  comportement précédent (message de page via les gestionnaires
  existants des deux pages).
- **Rétractation inchangée** : `annulerSuppressionCompte()` ne
  demande toujours aucun mot de passe.
- **Aucun SQL** : la RPC v1.5 `demander_suppression_compte` ne
  change pas.

## i18n (namespace v15, FR + EN, parité stricte)

- `deletionPasswordText` — explication affichée dans le dialogue.
- `deletionPasswordLabel` — libellé du champ.
- `errors.ERR_MOT_DE_PASSE_INCORRECT` — erreur « mot de passe
  incorrect : la demande n'a pas été enregistrée ».

## Tests

- `scripts/test-suppression-mdp.cjs` (branché dans
  `scripts/run-tests.sh`) : ordre vérification → RPC dans le code
  réel, garde démo avant changement d'état, dialogue (champ,
  erreur en place, confirmation verrouillée sans mot de passe),
  les deux pages branchées sur le dialogue partagé, clés FR/EN,
  et comportement démo (vide/blanc refusés sans changement d'état,
  demande posée avec mot de passe, rétractation sans mot de passe).
- `scripts/test-suppression-v15.cjs` : appels mis à jour avec un
  mot de passe démo (mécanique v1.5 inchangée).
- `scripts/test-correctif-grille-suppression.cjs` : les contrôles
  du point d'entrée Paramètres visent désormais le dialogue
  partagé (même intention : point d'entrée présent et branché).
