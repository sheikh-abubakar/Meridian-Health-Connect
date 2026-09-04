# Meridian Health Connect deployment

This repository supports local development and a split production deployment:

- Frontend: Vercel, with the Vercel project root set to `frontend`
- Backend: a persistent Node.js process on AWS (for example EC2), exposed through HTTPS on a DuckDNS hostname
- Database: MongoDB Atlas or another replica-set deployment (replica-set/change-stream support is required for live updates)

## 1. Production environment variables

### Vercel frontend

Set these in **Project Settings → Environment Variables** before deploying. Vite embeds these values at build time, so redeploy after changing them.

```env
VITE_API_URL=https://YOUR_MERIDIAN_NAME.duckdns.org/api
VITE_SOCKET_URL=https://YOUR_MERIDIAN_NAME.duckdns.org
```

`VITE_SOCKET_URL` is optional because the app can derive it from `VITE_API_URL`, but setting it explicitly makes the WebSocket origin unambiguous.

Vercel settings:

- Root Directory: `frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm ci`
- Node.js: 20.x or 22.x

The frontend is deployed directly by Vercel from the `frontend` directory. No repository `vercel.json` is used. If a Vercel project later returns 404 on direct refresh of nested React routes, configure an SPA fallback to `/index.html` in that Vercel project's routing settings.

### AWS backend

Create `backend/.env` on the server only. Never commit it.

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=5001
MONGODB_URI=mongodb+srv://USERNAME:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/meridian_health_connect?retryWrites=true&w=majority
JWT_SECRET=GENERATE_A_LONG_RANDOM_SECRET_OF_AT_LEAST_32_BYTES
JWT_EXPIRES_IN=8h
CORS_ORIGINS=https://YOUR_VERCEL_PROJECT.vercel.app
TRUST_PROXY=true
GROQ_API_KEY=YOUR_REAL_GROQ_API_KEY
SEED_ADMIN_PASSWORD=ONLY_SET_IF_YOU_INTENTIONALLY_RUN_THE_SEED_SCRIPT
```

If a custom frontend domain is added, list both exact origins separated by commas:

```env
CORS_ORIGINS=https://app.example.com,https://YOUR_VERCEL_PROJECT.vercel.app
```

Do not add a trailing slash. Do not use `*`: the API and Socket.IO server deliberately accept only configured origins.

`PORT=5001` is an example suitable when another Node project already occupies port 5000. Public traffic should not access 5001 directly; Nginx proxies HTTPS traffic to it.

## 2. Install and run on AWS EC2

From the checked-out repository:

```bash
cd backend
npm ci --omit=dev
npm run check
NODE_ENV=production npm start
```

Use a process supervisor such as systemd or the PM2 installation already used on the server. The process must start from the `backend` directory so dotenv reads `backend/.env`. Do not run `npm run seed` against production unless creating the initial, explicitly approved demo data.

Example PM2 command when PM2 is already installed:

```bash
cd /path/to/meridian-health-connect/backend
pm2 start src/server.js --name meridian-api
pm2 save
```

The application handles `SIGTERM`/`SIGINT`, closes Socket.IO/change streams, and disconnects MongoDB before exit.

## 3. Automatic backend deployment from GitHub

`.github/workflows/deploy-backend.yml` runs whenever `backend/**` is pushed to `main` (and can also be started manually). It validates syntax, runs the isolated acceptance tests, synchronizes only the backend to AWS, preserves the server's `.env`, installs production dependencies, reloads the dedicated `meridian-api` PM2 process, and checks the public health endpoint.

Add these in **GitHub repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `AWS_HOST` | EC2 public IP or resolvable AWS hostname |
| `AWS_USER` | SSH user, commonly `ubuntu` |
| `AWS_SSH_PRIVATE_KEY` | Full private deployment key including BEGIN/END lines |
| `AWS_KNOWN_HOSTS` | Verified `known_hosts` line for the EC2 host (obtain and verify once; do not blindly trust it during deployment) |
| `AWS_APP_DIR` | Dedicated absolute folder, e.g. `/home/ubuntu/apps/meridian/backend` |
| `BACKEND_HEALTH_URL` | `https://YOUR_MERIDIAN_NAME.duckdns.org/api/health` |
| `TEST_MONGODB_URI` | Dedicated MongoDB Atlas test connection URI; never the production database |
| `JWT_SECRET` | CI-only long random value |
| `GROQ_API_KEY` | CI secret required by runtime validation; it is not printed by the workflow |

One-time AWS preparation:

```bash
sudo mkdir -p /home/ubuntu/apps/meridian/backend
sudo chown -R ubuntu:ubuntu /home/ubuntu/apps/meridian
cd /home/ubuntu/apps/meridian/backend
# Create the production .env here before the first workflow run.
```

The workflow uses `rsync --delete` only inside the exact `AWS_APP_DIR`, while explicitly preserving `.env`. Give Meridian its own directory; never point `AWS_APP_DIR` at `/`, `/home`, `/var`, `/var/www`, or another project's folder.

## 4. DuckDNS and HTTPS reverse proxy

Point `YOUR_MERIDIAN_NAME.duckdns.org` at the EC2 public/Elastic IP. Keep the DuckDNS IP updater active if the instance does not use an Elastic IP.

Nginx site example:

```nginx
server {
    listen 80;
    server_name YOUR_MERIDIAN_NAME.duckdns.org;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 75s;
    }
}
```

Issue a TLS certificate (for example with Certbot) and redirect HTTP to HTTPS. The Vercel site is HTTPS, so browsers will block an insecure `http://`/`ws://` backend as mixed content. With HTTPS at Nginx, Socket.IO automatically uses secure WSS.

AWS Security Group guidance:

- Allow inbound TCP 80 and 443 from the internet.
- Allow SSH only from a trusted administrator IP.
- Do not expose application port 5001 or MongoDB publicly.

## 5. MongoDB requirements

- Use a dedicated production database/user with least-privilege credentials.
- Permit the AWS server IP in Atlas Network Access; do not use unrestricted access for a real deployment.
- The database must support change streams (Atlas does); real-time Socket.IO notifications depend on them.
- Keep `TEST_MONGODB_URI` unset in production. Automated tests always create/drop disposable test-named databases and should be run in CI or a dedicated test environment.

## 6. Verification after deployment

```bash
curl https://YOUR_MERIDIAN_NAME.duckdns.org/api/health
```

Expected response while MongoDB is ready:

```json
{"success":true,"data":{"status":"ready"}}
```

Then verify:

1. Open the Vercel `/login` URL and sign in.
2. Refresh a nested route to confirm SPA fallback.
3. Open two sessions in the same branch and confirm the Live indicator and a real-time update.
4. Confirm a different branch does not receive the event.
5. Generate a PDF export and an AI summary.
6. Review backend logs and the in-app Audit Log.

## 7. Deployment notes

- DuckDNS controls DNS, not the Node port. The public frontend always calls standard HTTPS port 443; Nginx maps it internally to `PORT=5001`.
- Production and local ports are independent. Keep local `backend/.env` at `PORT=5000` unless another local process already uses it; set only the AWS `backend/.env` to `PORT=5001` when port 5000 is occupied there.
- The backend must be a persistent service. Do not deploy this Socket.IO/change-stream server as a short-lived serverless function.
- Vercel preview URLs are not automatically trusted. Add an exact preview URL to `CORS_ORIGINS` temporarily when testing a preview deployment, then restart the backend.
- Rotate `JWT_SECRET`, MongoDB credentials, and `GROQ_API_KEY` if any secret is ever exposed.
