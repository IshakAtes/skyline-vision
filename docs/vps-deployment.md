# Grenady VPS Deployment mit Docker Compose

Diese Anleitung beschreibt das produktive Deployment von Grenady auf einem VPS. Die App laeuft als Docker-Container, wird per Docker Compose verwaltet und verwendet Nodemailer + SMTP fuer das Kontaktformular. Secrets liegen nicht im Repository, sondern nur auf dem VPS in `/opt/grenady/.env`.

## Ergebnis

- Image: `ghcr.io/ishakates/grenady:latest`
- Container: `grenady-app`
- Compose-Service: `grenady-app`
- Deployment-Ordner: `/opt/grenady`
- Compose-Datei auf dem VPS: `/opt/grenady/docker-compose.yml`
- Runtime-Env auf dem VPS: `/opt/grenady/.env`
- Oeffentlicher Zugriff: Traefik routet `grenady.de` und `www.grenady.de`
- Interner App-Port: `3000`
- Gemeinsames Docker-Netzwerk: `traefik-proxy`
- Kein direktes Host-Port-Binding fuer Grenady

## GitHub Actions Ablauf

Pull Requests auf `main`:

```text
npm ci
npm run lint
npm run build
docker build
```

Es wird nur geprueft und gebaut. Pull Requests deployen nicht.

Push auf `main`:

```text
npm ci
npm run lint
npm run build
docker build
docker push ghcr.io/ishakates/grenady:latest
docker push ghcr.io/ishakates/grenady:<commit-sha>
scp docker-compose.yml /opt/grenady/docker-compose.yml
ssh VPS
cd /opt/grenady
docker compose pull
docker rm -f grenady-app || true # only needed once if a legacy non-Compose container exists
docker compose up -d --remove-orphans
docker image prune -f
```

## GitHub Secrets

In GitHub setzen unter `Repository -> Settings -> Secrets and variables -> Actions`:

```text
VPS_HOST
VPS_USER
VPS_SSH_KEY
VPS_PORT
```

Optional, falls das GHCR-Package privat ist und der VPS pullen muss:

```text
GHCR_PAT
```

`GHCR_PAT` braucht mindestens `read:packages`. Der Workflow selbst pusht mit `GITHUB_TOKEN`.

## VPS Env-Datei

Diese Datei bleibt nur auf dem VPS und wird vom Workflow nicht ueberschrieben:

```bash
sudo mkdir -p /opt/grenady
sudo nano /opt/grenady/.env
chmod 600 /opt/grenady/.env
```

Beispiel:

```env
NODE_ENV=production
PORT=3000
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mail@example.com
SMTP_PASS=dein-smtp-passwort
SMTP_FROM="Grenady <mail@grenady.de>"
INQUIRY_RECIPIENT_EMAIL=ishakfeuer@gmail.com
INQUIRY_ALLOWED_ORIGIN=https://grenady.de,https://www.grenady.de
```

Wenn du direkt ueber die Server-IP testest, fuege den Origin hinzu:

```env
INQUIRY_ALLOWED_ORIGIN=http://152.239.118.181,https://grenady.de,https://www.grenady.de
```

## Einmalige VPS Vorbereitung

Docker und Compose-Plugin installieren:

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Deployment-User fuer Docker berechtigen:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
docker ps
docker compose version
```

Deployment-Ordner und Env-Datei anlegen:

```bash
sudo mkdir -p /opt/grenady
sudo chown "$USER":"$USER" /opt/grenady
nano /opt/grenady/.env
chmod 600 /opt/grenady/.env
```

Falls das GHCR-Package privat ist, einmalig auf dem VPS einloggen:

```bash
echo "<GHCR_PAT>" | docker login ghcr.io -u "<github-user>" --password-stdin
```

## Traefik Reverse Proxy

Grenady wird nicht direkt auf Port 80, 443 oder 3000 am Host veroeffentlicht. Traefik laeuft als separates Hostinger Docker Manager Projekt und routet anhand der Docker Labels in `docker-compose.yml`.

Vor dem Grenady-Deploy pruefen:

```bash
docker ps
docker network ls
docker inspect <traefik-container> --format '{{.HostConfig.NetworkMode}}'
ss -tln | grep -E ':80|:443' || true
```

Erwartung:

- Ein Traefik-Container laeuft.
- Traefik belegt Port 80 und 443.
- Das externe Netzwerk `traefik-proxy` existiert.
- Wenn Traefik im `host` NetworkMode laeuft, wird er nicht mit `traefik-proxy` verbunden.
- Wenn Traefik nicht im `host` NetworkMode laeuft, haengt der Traefik-Container ebenfalls im Netzwerk `traefik-proxy`.

Falls `traefik-proxy` fehlt, legt der Deploy-Workflow das gemeinsame Netzwerk an. Grenady verwendet dieses Netzwerk als externes Compose-Netzwerk.

## Docker Compose pruefen

Auf dem VPS:

```bash
cd /opt/grenady
docker compose config
docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f
```

Wenn `docker compose up -d` meldet, dass der Name `/grenady-app` schon vergeben ist, existiert noch ein alter Container, der nicht von diesem Compose-Projekt verwaltet wird. Einmalig entfernen:

```bash
docker rm -f grenady-app || true
cd /opt/grenady
docker compose up -d
```

## Debug-Befehle

```bash
docker ps
docker logs grenady-app
docker exec grenady-app node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"
docker network inspect traefik-proxy
ss -tln | grep -E ':80|:443' || true
```

Wenn keine E-Mail ankommt:

```bash
docker logs grenady-app
docker exec -it grenady-app env | grep -E 'SMTP|INQUIRY'
```

Pruefe dann SMTP-Werte, Absenderdomain, Login-Daten beim Mailprovider und `INQUIRY_ALLOWED_ORIGIN`.
