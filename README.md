# Northstar Identity — OAuth 2.0 Authentication + AWS CI/CD

Full-stack React + Express + MongoDB authentication starter with email/password, Google OAuth 2.0, Microsoft Entra ID OpenID Connect, password reset, protected dashboard, and GitHub Actions deployment to AWS EC2.

## Local development

Requirements: Node.js 20+, npm, and MongoDB (local or Atlas).

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGODB_URI`, `SESSION_SECRET`, and `JWT_SECRET`.
3. Optional: configure Google and Microsoft OAuth credentials using the sections below.
4. Install and start:

```bash
npm install
npm run install:all
npm run dev
```

Open `http://localhost:5173`. Backend health check: `http://localhost:5000/api/health`.

## Google OAuth

In Google Cloud Console, create an OAuth client of type Web application. Add this authorized redirect URI:

`http://localhost:5000/api/auth/google/callback`

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `backend/.env`.

## Microsoft Entra ID

Create an App registration in Microsoft Entra. Add a Web redirect URI:

`http://localhost:5000/api/auth/microsoft/callback`

Create a client secret and set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, and `MICROSOFT_CALLBACK_URL`.

## AWS deployment architecture

This included pipeline deploys a single-instance learning/demo deployment:

- GitHub Actions: install, frontend production build, backend syntax check, Compose validation.
- AWS EC2: Docker Compose builds and runs the backend and frontend containers.
- Nginx in the frontend container serves the React build and reverse-proxies `/api` to Express.
- MongoDB Atlas is the recommended managed database. MongoDB is not installed on the EC2 instance.

The GitHub Actions workflow is `.github/workflows/aws-ec2-deploy.yml`. It deploys only pushes to `main`; pull requests run validation/build but do not deploy.

### A. Create MongoDB Atlas database

1. Create a cluster at https://www.mongodb.com/atlas.
2. Create a database user and allow the EC2 server's public IP in Network Access (or configure a carefully scoped network strategy).
3. Copy the connection string and set it as `MONGODB_URI` in `backend/.env` on EC2.

### B. Launch EC2

1. Launch Ubuntu Server 24.04 LTS (or 22.04) EC2.
2. For a learning deployment, a small instance such as `t3.small` is a practical starting point; select sizing based on your usage.
3. Create/use an SSH key pair and save the private key securely.
4. Security Group inbound rules:
   - SSH TCP 22: restrict source to your own public IP (do not use `0.0.0.0/0` for SSH).
   - HTTP TCP 80: allow users to visit the app.
   - HTTPS TCP 443: add when TLS is configured.
5. Connect to the instance and install Docker:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git rsync
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out and reconnect so the Docker group membership applies. Verify:

```bash
docker --version
docker compose version
```

### C. Prepare deployment folder and backend environment on EC2

The workflow user needs write access to the deployment directory. Example:

```bash
mkdir -p ~/northstar-auth
```

On EC2, create `~/northstar-auth/backend/.env` after the first workflow copy (or create the folder first). Put your real values there. Do not commit or upload this file from GitHub.

Required production values:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=http://YOUR_EC2_PUBLIC_IP
BACKEND_URL=http://YOUR_EC2_PUBLIC_IP
MONGODB_URI=YOUR_MONGODB_ATLAS_CONNECTION_STRING
SESSION_SECRET=LONG_RANDOM_SECRET_VALUE
JWT_SECRET=DIFFERENT_LONG_RANDOM_SECRET_VALUE
COOKIE_SECURE=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://YOUR_EC2_PUBLIC_IP/api/auth/google/callback
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
MICROSOFT_CALLBACK_URL=http://YOUR_EC2_PUBLIC_IP/api/auth/microsoft/callback
```

Set the frontend/backend URL and OAuth callback URLs to your final domain when you configure DNS and HTTPS. Do not use an EC2 IP as a long-term production identity URL.

**Important:** `rsync --exclude backend/.env` preserves the EC2 secret file across deployments. Create it before the first deployment. The deployment folder should be owned by the SSH deployment user.

### D. Add GitHub repository secrets

Push this project to a GitHub repository. In GitHub, open:

Settings → Secrets and variables → Actions → New repository secret

Add:

| Secret | Value |
|---|---|
| `EC2_HOST` | EC2 public IPv4 address or DNS |
| `EC2_USER` | Usually `ubuntu` for Ubuntu AMIs |
| `EC2_SSH_KEY` | Full PEM private key contents |
| `EC2_DEPLOY_PATH` | Absolute path, e.g. `/home/ubuntu/northstar-auth` |

Do not put `.env` values or OAuth secrets in GitHub for this SSH deployment; keep them in the EC2 `backend/.env` file. Protect the `main` branch and require successful checks before merging.

### E. Push and deploy

From the project root:

```bash
git init
git add .
git commit -m "Add OAuth authentication app and AWS deployment pipeline"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Every push to `main` triggers the workflow. Open GitHub → Actions to follow build and deployment logs. When deployment succeeds, visit `http://YOUR_EC2_PUBLIC_IP`.

If the workflow fails, inspect the failed Actions step. On EC2, useful commands are:

```bash
cd ~/northstar-auth
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

### F. Add HTTPS before real production use

Do not collect real user passwords over plain HTTP. For production, point a domain to the EC2 instance, configure TLS with a reverse proxy/load balancer and a trusted certificate (for example AWS Application Load Balancer + ACM, or a carefully maintained TLS proxy), then:

- Set `FRONTEND_URL` and `BACKEND_URL` to the HTTPS origin.
- Set OAuth callback URLs to HTTPS and update the Google/Microsoft app registrations.
- Set `COOKIE_SECURE=true`.
- Restrict inbound access appropriately.
- Add backups, monitoring, patching, and a deployment rollback strategy.

For a more resilient production setup, use an Application Load Balancer, Auto Scaling, managed container deployment, private networking, and managed secrets rather than relying on a single EC2 instance.

## CI/CD workflow behavior

| Trigger | What happens |
|---|---|
| Pull request to `main` | Install dependencies, build frontend, syntax-check backend, validate Docker Compose |
| Push to `main` | Run the same checks, copy source to EC2 over SSH, build images on EC2, restart containers |
| Manual run | Available through Actions → Build and Deploy to AWS EC2 → Run workflow |

## Security notes

- OAuth uses Authorization Code + PKCE, state and nonce checks, and JWT signature/audience validation against provider JWKS.
- Passwords are bcrypt-hashed. Reset tokens are hashed and expire after 30 minutes.
- Auth JWT is stored in an HTTP-only cookie.
- Never commit `.env`, private keys, OAuth client secrets, or MongoDB credentials.
- The included EC2 deployment is a starter pattern, not a high-availability architecture. Complete HTTPS, domain, firewall, backup, monitoring, and security review before production use.
- The UI's Remember Me checkbox is currently presentation-only; the starter uses a fixed one-hour JWT lifetime.
