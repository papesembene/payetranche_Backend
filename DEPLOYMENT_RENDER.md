# Déploiement Render

Ce backend est prêt pour un déploiement Render avec Node.js, PostgreSQL et Prisma.

## 1. Créer le repo GitHub

Depuis ce dossier `PAYTRANCHE-BACKEND` :

```bash
git init
git add .
git commit -m "Prepare PayTranche backend for Render"
git branch -M main
git remote add origin <URL_DU_REPO_GITHUB>
git push -u origin main
```

Ne poussez jamais le fichier `.env`. Il est ignoré par `.gitignore`.

## 2. Déployer avec `render.yaml`

Dans Render :

1. New > Blueprint
2. Connecter le repo GitHub du backend
3. Render détecte `render.yaml`
4. Renseigner les variables marquées `sync: false`
5. Lancer le déploiement

Le fichier `render.yaml` crée :

- un service web `paytranche-api`
- une base PostgreSQL `paytranche-postgres`
- `DATABASE_URL` branché automatiquement vers PostgreSQL
- une commande de build
- une commande de migration Prisma
- un health check `/api/health`

## 3. Variables Render à remplir

Valeurs obligatoires :

```env
FRONTEND_URL=https://votre-frontend-render-ou-domaine.com
CORS_ORIGIN=https://votre-frontend-render-ou-domaine.com
PUBLIC_API_URL=https://votre-backend-render-ou-domaine.com
GOOGLE_CLIENT_ID=<client-id-google>
PAYTECH_API_KEY=<api-key-paytech>
PAYTECH_API_SECRET=<api-secret-paytech>
PLATFORM_ADMIN_EMAILS=votre-email-admin@example.com
```

Valeurs recommandées au premier déploiement :

```env
PAYTECH_ENV=test
PAYTECH_AUTO_PAYOUTS_ENABLED=false
PAYTRANCHE_COMMISSION_RATE=0
ALLOW_DEV_ADMIN=false
```

`JWT_SECRET` est généré automatiquement par Render via `render.yaml`.

## 4. Commandes Render

Build command :

```bash
npm ci && npm run build
```

Pre-deploy command :

```bash
npm run prisma:migrate:deploy
```

Start command :

```bash
npm start
```

Si votre plan Render ne permet pas le pre-deploy command, utilisez temporairement :

```bash
npm run start:render
```

Ce mode lance `prisma migrate deploy` au démarrage, puis démarre l’API.

## 5. Après le premier déploiement

Vérifiez :

```txt
GET https://votre-backend.onrender.com/api/health
```

Puis dans l’admin PayTranche :

```txt
/admin > Configuration
```

Copiez les URLs callback affichées dans votre espace PayTech si PayTech vous les demande.

## 6. Passage production PayTech

Ne passez pas directement les reversements automatiques en production.

Ordre recommandé :

1. Déployer backend et frontend avec URLs stables
2. Mettre `PUBLIC_API_URL` sur l’URL Render du backend
3. Mettre `FRONTEND_URL` et `CORS_ORIGIN` sur l’URL Render du frontend
4. Tester un paiement PayTech en mode test
5. Demander l’activation production PayTech
6. Mettre `PAYTECH_ENV=prod`
7. Tester un petit paiement réel
8. Garder `PAYTECH_AUTO_PAYOUTS_ENABLED=false`
9. Activer les reversements automatiques seulement après validation PayTech
