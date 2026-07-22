# Supabase — Qualiopi audit

La source de vérité du schéma est `supabase/migrations/20260717_initial.sql`.

## Déploiement

```sh
supabase link --project-ref zqvimqzjqflworrdctei
supabase db push
```

Le client utilise uniquement l’URL publique et la clé publishable de `js/supabase-config.js`. Aucune clé `service_role` ne doit être placée dans le dépôt ou le navigateur.

## Authentification et autorisations

- inscription ou connexion email activée ;
- tout email se terminant exactement par `@formationentredeux.com` est marqué `staff` par un trigger en base ;
- un utilisateur externe doit avoir une invitation active correspondant exactement à son email ;
- l’acceptation ajoute uniquement l’audit invité à ses memberships ;
- toutes les mutations métier sont réservées au staff par RLS ;
- le viewer dispose uniquement de `SELECT` sur l’audit partagé et ses preuves ;
- les fichiers sont conservés dans le bucket privé `audit-evidence` et téléchargés avec une URL signée courte.

Dans **Authentication → URL Configuration**, la Site URL et les Redirect URLs doivent inclure l’URL de production GitHub Pages.
