# PayTranche Backend

Backend SaaS pour PayTranche, construit avec Node.js, Express, TypeScript et Prisma.

## Stack

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod pour la validation
- Helmet et CORS

## Structure

```txt
src/
├── app.ts
├── server.ts
├── controllers/
├── middlewares/
├── models/
├── routes/
├── schemas/
├── services/
├── types/
└── utils/
```

## Multi-tenant

Les routes sensibles nécessitent le header suivant :

```http
x-tenant-id: <tenantId>
Authorization: Bearer <jwt>
```

Toutes les données clients, crédits et paiements sont filtrées par `tenantId`.

L'inscription crée une entreprise et le premier utilisateur. C'est la seule route métier qui ne peut pas encore avoir de `tenantId`, puisqu'elle sert justement à le créer.

## Ressources API

```txt
GET    /api/health

POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/tenants/me

GET    /api/subscription/me
PATCH  /api/subscription/me

GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PATCH  /api/clients/:id
DELETE /api/clients/:id

GET    /api/credits
POST   /api/credits
GET    /api/credits/:id
PATCH  /api/credits/:id
DELETE /api/credits/:id

GET    /api/payments
POST   /api/payments
GET    /api/payments/:id

GET    /api/analytics/dashboard

GET    /api/notifications/alerts
PATCH  /api/notifications/alerts/:id/read
POST   /api/notifications/scan-overdue
```

## Plans SaaS

```txt
GRATUIT    max 5 clients
PRO        clients illimités
ENTREPRISE clients illimités, support avancé
```

Les actions sensibles passent par un middleware de plan. La création de client applique la limite du plan courant.

## Commandes

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
npm run build
npm start
```

Pour Render :

```bash
npm ci && npm run build
npm run prisma:migrate:deploy
npm start
```

Guide complet : [DEPLOYMENT_RENDER.md](./DEPLOYMENT_RENDER.md)

## Variables d'environnement

```env
DATABASE_URL="postgresql://user:password@localhost:5432/paytranche"
PORT=8000
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:5173"
CORS_ORIGIN="http://localhost:5173"
PUBLIC_API_URL="http://localhost:8000"
GOOGLE_CLIENT_ID=""
FIREBASE_PROJECT_ID=""
PAYTECH_ENV="test"
PAYTECH_API_KEY=""
PAYTECH_API_SECRET=""
PAYTECH_AUTO_PAYOUTS_ENABLED=false
PAYTRANCHE_COMMISSION_RATE=0
PLATFORM_ADMIN_EMAILS=""
ALLOW_DEV_ADMIN=false
```

## Exemple rapide

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Demo SARL","name":"Awa Diop","email":"awa@example.com","password":"password123"}'

curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <tenantId>" \
  -d '{"email":"awa@example.com","password":"password123"}'
```
