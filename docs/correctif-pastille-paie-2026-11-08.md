# Correctif — pastille d'état d'une ligne de paie (2026-11-08)

**Défaut constaté en réel** (capture du fondateur) : sur la page console
« Paie & Dépenses » (`/console/finances-plateforme`), la pastille d'état
d'une ligne SANS paie émise affichait toujours « Émission impossible »,
même quand la ligne n'avait AUCUN blocage et que le formulaire
d'émission (référence + bouton « Émettre la paie ») était affiché juste
en dessous — contradiction visible.

**Cause** : dans `app/[locale]/console/finances-plateforme/page.tsx`,
la branche « pas de paie » de la pastille rendait `statusBlocked`
inconditionnellement, sans regarder `ligne.blocages`.

**Correctif** (libellé seulement, aucune logique touchée) :
- paie émise → pastille verte « Paie émise » (inchangé) ;
- pas de paie + `blocages` non vide → pastille ambre
  « Émission impossible » (inchangé) ;
- pas de paie + `blocages` vide → pastille ambre **« À émettre »**
  (nouvelle clé i18n `financesPlateforme.statusToIssue` :
  FR « À émettre » / EN « To issue », parité vérifiée par la suite).

**Test** : contrôle statique ciblé dans `scripts/test-finances-plateforme.cjs`
(condition sur `ligne.blocages.length > 0`, présence des deux clés
`statusBlocked`/`statusToIssue` dans la page et des libellés FR/EN).
Suite complète verte, build OK.
