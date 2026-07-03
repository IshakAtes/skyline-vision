# Grenady

React/Vite website with a small Node production server for the configurator API and SMTP e-mail delivery via Nodemailer.

## Local Development

Create `.env.local` from `.env.example` and fill in SMTP test credentials. For local Vite usage, set:

```env
INQUIRY_ALLOWED_ORIGIN=http://127.0.0.1:5173
```

Then run:

```bash
npm ci
npm run dev:api
npm run dev
```

The Vite dev server proxies `/api/send-inquiry` to the local API at `http://127.0.0.1:8787`.

## Local Production Test

```bash
npm run lint
VITE_BASE_PATH=/ npm run build
npm run start
```

Open:

```text
http://127.0.0.1:3000
```

Health endpoint:

```bash
curl -I http://127.0.0.1:3000/healthz
```

API test with dummy data:

```bash
curl -X POST http://127.0.0.1:3000/api/send-inquiry \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Kunde","email":"kunde@example.com","phone":"0123456789","projectTypes":["website"],"notes":"SMTP Test"}'
```

Errors are visible in the server terminal or container logs.

## Production Container

The Docker image builds the Vite frontend first and then starts the Node production server:

```bash
docker build --build-arg VITE_BASE_PATH=/ -t grenady-app:local .
docker run --rm --env-file .env.local -p 127.0.0.1:3000:3000 grenady-app:local
```

Internal container port: `3000`

`.env` files are ignored by Git and Docker and must not be copied into the image.

## Deployment

Full VPS deployment instructions are in [docs/vps-deployment.md](docs/vps-deployment.md).
Production traffic is routed through the shared Hostinger Traefik proxy.

## Required Runtime ENV

```env
NODE_ENV=production
PORT=3000
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Grenady <mail@grenady.de>"
INQUIRY_RECIPIENT_EMAIL=ishakfeuer@gmail.com
INQUIRY_ALLOWED_ORIGIN=https://grenady.de,https://www.grenady.de
```
