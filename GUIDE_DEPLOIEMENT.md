# Guide de déploiement KELASI

1. **Supabase** — Dans le SQL Editor, exécuter dans l’ordre : `SUPABASE_A_EXECUTER.sql`, `SUPABASE_SYNC_V1.4.sql`, `SUPABASE_DEPENSES_V1.6.sql`, puis `SUPABASE_V1.8_CORRECTIF.sql` (tous relançables sans risque). Pour un usage personnel, désactiver au besoin **Confirm email** dans **Auth → Providers → Email**.
2. **Netlify** — Connecter ce dépôt GitHub à Netlify (ou déposer le dossier `dist` produit par `npm run build` dans Netlify Drop). La commande `npm run build`, le dossier `dist` et les règles SPA sont déjà configurés.
3. **Téléphone** — Ouvrir l’URL Netlify en HTTPS, se connecter au même compte, puis choisir **Installer** (Android) ou **Partager → Sur l’écran d’accueil** (iPhone/iPad).
