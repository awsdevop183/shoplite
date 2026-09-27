# ShopLite — a simple 3-tier app for teaching EC2 deployment

A small product-inventory app built to demonstrate a classic **3-tier
architecture**, with each tier on its **own EC2 instance**:

| Tier | What | Tech | Port | Runs as |
|------|------|------|------|---------|
| 1. Frontend (presentation) | Web UI | React (Vite), built to static files | 80 | **Nginx** (`nginx` service) |
| 2. Backend (application) | REST API | Node.js + Express + mysql2 | 5000 | systemd service `shoplite-backend` |
| 3. Database (data) | Stores products | MySQL 8 | 3306 | `mysql` service (installed by apt) |

![ShopLite screenshot](docs/screenshot.png)

The top of the page is a live **status board** showing whether each tier is up:
Nginx, the Node.js API behind it, and MySQL behind that. It never shows backend
or database IP addresses. Stop a service or break a security-group rule and viewers see the tier
turn **DOWN**.

---

## How the traffic flows

```
   Your browser (on the internet)
          │
          │ (1) http://FRONTEND_PUBLIC_IP/            → the React app
          │ (2) http://FRONTEND_PUBLIC_IP/api/...     → API calls
          ▼
┌──────────────────┐ (3) /api/... over  ┌──────────────┐ (4) SQL over  ┌──────────────┐
│  FRONTEND EC2    │     PRIVATE IP     │  BACKEND EC2 │  PRIVATE IP   │ DATABASE EC2 │
│  Nginx :80       │ ─────────────────► │  Node :5000  │ ────────────► │ MySQL :3306  │
│  public IP       │                    │              │               │              │
└──────────────────┘                    └──────────────┘               └──────────────┘
```

1. The browser downloads the built React app (HTML/JS/CSS) from **Nginx** on the
   frontend server.
2. The React code calls **`/api/...` on the same server** it was loaded from.
3. Nginx **reverse-proxies** every `/api/` request to the backend's **private IP**
   (`location /api/` in `frontend/nginx/shoplite.conf`).
4. The backend connects to MySQL using the database's **private IP**.

**Why a proxy?** The React code runs in the viewer's **browser**, outside AWS. A
browser can't reach private IPs like `172.31.x.x`. So `curl http://172.31.x.x:5000`
works *on an EC2*, but the same URL fails from the UI. With the proxy, only Nginx
talks to the backend, over the VPC's private network.

> The backend can **still** be opened directly at `http://BACKEND_PUBLIC_IP:5000/api/products`
> if you allow port 5000 from the internet. That's handy for demoing the API with
> a browser, curl or Postman, but the UI doesn't need it.

### Where each address is configured (worth explaining on camera)

- **Backend:** `DB_HOST` lives in `backend/.env`, read **every time the app starts**
  (`server.js` loads it with `dotenv`). Change it, then `systemctl restart shoplite-backend`.
- **Frontend (React):** contains **no addresses at all**. It always calls `/api` on
  the server it was loaded from, so the same build works on any server.
- **Nginx:** the backend's private IP lives only in the Nginx config. If it changes,
  edit the config and `sudo systemctl reload nginx`. No rebuild.

---

## Folder layout

```
shoplite/
├── database/
│   ├── schema.sql                  # creates DB `shoplite`, table `products`, sample rows
│   └── create-user.sql             # creates app user `shopuser` for remote access
├── backend/
│   ├── server.js                   # Express API
│   ├── package.json
│   ├── .env.example                # DB_HOST, DB_USER, DB_PASSWORD...
│   └── shoplite-backend.service    # systemd unit
└── frontend/                       # React app (Vite)
    ├── index.html
    ├── src/
    │   ├── main.jsx                # React entry point
    │   ├── App.jsx                 # status board, add form, product table
    │   ├── api.js                  # fetch() calls to the backend
    │   └── style.css
    ├── package.json
    ├── vite.config.js
    └── nginx/shoplite.conf         # Nginx site config + /api reverse proxy
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend hostname and DB host/status/version (the UI doesn't display the hostname or IPs) |
| GET | `/api/products` | List products |
| POST | `/api/products` | Add product: `{"name":"Mouse","price":19.99,"stock":10}` |
| PUT | `/api/products/:id` | Update a product. Send all fields: `{"name":"Mouse","price":17.99,"stock":8}` |
| DELETE | `/api/products/:id` | Delete a product |

Try them with `curl` (replace the IP):

```bash
API=http://BACKEND_PUBLIC_IP:5000
curl $API/api/health
curl $API/api/products
curl -X POST   $API/api/products   -H 'Content-Type: application/json' -d '{"name":"Webcam","price":39.5,"stock":5}'
curl -X PUT    $API/api/products/1 -H 'Content-Type: application/json' -d '{"name":"Wireless Mouse","price":17.99,"stock":45}'
curl -X DELETE $API/api/products/1
```

---

## Step 0: Launch 3 EC2 instances

Use **Ubuntu Server 24.04 LTS**, `t2.micro`/`t3.micro`, all in the **same VPC**
(the default VPC is fine). Name them `shoplite-frontend`, `shoplite-backend`,
`shoplite-db`.

### Security groups

Create one security group per tier. The DB rule that references the **backend's
security group** (not an IP) is a good concept to teach.

| Security group | Inbound rule | Source |
|----------------|--------------|--------|
| `sg-frontend` | SSH 22 | My IP |
|  | HTTP **80** | `0.0.0.0/0` |
| `sg-backend` | SSH 22 | My IP |
|  | Custom TCP **5000** | **`sg-frontend`** (Nginx proxies `/api` to it) |
|  | Custom TCP **5000** *(optional)* | `0.0.0.0/0`, only to demo the API from your laptop |
| `sg-db` | SSH 22 | My IP |
|  | MySQL/Aurora **3306** | **`sg-backend`** (only the backend can reach the DB) |

Write down these IPs; you'll need them below:

- `DB_PRIVATE_IP`: private IPv4 of `shoplite-db`
- `BACKEND_PRIVATE_IP`: private IPv4 of `shoplite-backend` (used in the Nginx config)
- `BACKEND_PUBLIC_IP`: public IPv4 of `shoplite-backend` (only for SSH and API demos)
- `FRONTEND_PUBLIC_IP`: public IPv4 of `shoplite-frontend`

> Public IPs change when you **stop/start** an instance; private IPs don't. The
> app only uses private IPs between servers, so a restart doesn't break it.

Get the code onto each server with `git clone` (below) or `scp`.

---

## Step 1: Database server (`shoplite-db`)

```bash
ssh -i key.pem ubuntu@DB_PUBLIC_IP

sudo apt update
sudo apt install -y mysql-server git
sudo systemctl enable --now mysql
sudo systemctl status mysql

git clone https://github.com/awsdevop183/shoplite.git
cd shoplite/database

# Create database, table and sample data
sudo mysql < schema.sql

# Create the app user. EDIT THE PASSWORD in create-user.sql first!
nano create-user.sql
sudo mysql < create-user.sql
```

**Allow remote connections.** By default MySQL only listens on `127.0.0.1`:

```bash
sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql

sudo ss -tlnp | grep 3306      # should now show 0.0.0.0:3306
```

Verify:

```bash
sudo mysql -e "SELECT * FROM shoplite.products;"
sudo mysql -e "SELECT user, host FROM mysql.user WHERE user='shopuser';"
```

---

## Step 2: Backend server (`shoplite-backend`)

```bash
ssh -i key.pem ubuntu@BACKEND_PUBLIC_IP

sudo apt update
sudo apt install -y nodejs npm git mysql-client
node -v

# Optional but good to demo: can this server reach the DB? (uses the DB PRIVATE IP)
mysql -h DB_PRIVATE_IP -u shopuser -p -e "SELECT COUNT(*) FROM shoplite.products;"

git clone https://github.com/awsdevop183/shoplite.git
sudo cp -r shoplite/backend /opt/shoplite-backend
sudo chown -R ubuntu:ubuntu /opt/shoplite-backend
cd /opt/shoplite-backend

npm install

cp .env.example .env
nano .env          # set DB_HOST=DB_PRIVATE_IP and DB_PASSWORD
```

**Run it manually first** (useful for showing what a service *replaces*):

```bash
node server.js     # reads .env from this folder (via the dotenv package)
# in another terminal:  curl localhost:5000/api/health
# Ctrl+C to stop
```

**Now make it a Linux service:**

```bash
sudo cp shoplite-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now shoplite-backend
sudo systemctl status shoplite-backend
journalctl -u shoplite-backend -f          # live logs (Ctrl+C to exit)
```

**Test from the internet** (your laptop's browser or terminal). This needs the optional
`0.0.0.0/0` rule on port 5000 in `sg-backend`:

```
http://BACKEND_PUBLIC_IP:5000/api/health
http://BACKEND_PUBLIC_IP:5000/api/products
```

---

## Step 3: Frontend server (`shoplite-frontend`)

```bash
ssh -i key.pem ubuntu@FRONTEND_PUBLIC_IP

sudo apt update
sudo apt install -y nodejs npm git nginx
sudo systemctl enable --now nginx     # visit http://FRONTEND_PUBLIC_IP: Nginx welcome page

git clone https://github.com/awsdevop183/shoplite.git
cd shoplite/frontend
```

**1. Build the React app:**

```bash
npm install
npm run build              # creates dist/ with index.html + assets/*.js, *.css
ls dist dist/assets
```

**2. Copy the build to Nginx's web folder:**

```bash
sudo mkdir -p /var/www/shoplite
sudo cp -r dist/* /var/www/shoplite/
```

**3. Configure Nginx to serve it and proxy `/api` to the backend:**

```bash
# Put the backend's PRIVATE IP into the config (e.g. 172.31.11.109)
sed -i 's/BACKEND_PRIVATE_IP/172.31.11.109/' nginx/shoplite.conf
grep proxy_pass nginx/shoplite.conf           # check: proxy_pass http://172.31.11.109:5000;

sudo cp nginx/shoplite.conf /etc/nginx/sites-available/shoplite
sudo ln -s /etc/nginx/sites-available/shoplite /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default      # remove the welcome page site

sudo nginx -t                                 # always test the config first
sudo systemctl reload nginx

# Test the proxy from the frontend server itself
curl http://localhost/api/health
```

Nginx is already a systemd service (installed and enabled by apt), so the
frontend needs no service file of its own. It starts on boot automatically.

**Redeploying after a code change:**

```bash
cd ~/shoplite && git pull
cd frontend && npm run build
sudo rm -rf /var/www/shoplite/* && sudo cp -r dist/* /var/www/shoplite/
```

No Nginx restart is needed for new files. Just refresh the browser.

Open the app: **`http://FRONTEND_PUBLIC_IP`**

All three status cards should say **UP**. Add and delete a product, then show
the row in MySQL on the DB server:

```bash
sudo mysql -e "SELECT * FROM shoplite.products;"
```

---

## Demo ideas for the video

| Show this | Do this | What viewers see |
|-----------|---------|------------------|
| Services auto-restart | `sudo kill -9 $(pgrep -f "node server.js")` on backend | Comes back in ~5s (`Restart=always`) |
| Services survive reboot | `sudo reboot` the backend | App works again after boot (`enable`) |
| Frontend down | `sudo systemctl stop nginx` | Page doesn't load at all (connection refused) |
| Backend down | `sudo systemctl stop shoplite-backend` | Backend and DB cards turn **DOWN** |
| DB down | `sudo systemctl stop mysql` on DB server | Backend **UP**, Database **DOWN** (`ECONNREFUSED`) |
| Security groups matter | Remove the 3306 rule from `sg-db` | Database **DOWN**, error `ETIMEDOUT` |
| Security groups matter | Remove the 5000-from-`sg-frontend` rule in `sg-backend` | Nginx can't reach the backend: Backend **DOWN**, `HTTP 504` after the timeout |
| Reverse proxy | Browser DevTools → Network while using the app | All calls go to `FRONTEND_PUBLIC_IP/api/...`, never to port 5000 |
| Private IPs vs browser | From your laptop: `curl http://BACKEND_PRIVATE_IP:5000/api/health` | Fails, while the same command on the frontend EC2 works. Only servers in the VPC can reach private IPs |
| DB is private | From your laptop: `mysql -h DB_PUBLIC_IP ...` | Times out, since only `sg-backend` is allowed |
| Logs | `journalctl -u shoplite-backend -f` while clicking | Every API request is logged |
| Nginx logs | `sudo tail -f /var/log/nginx/shoplite.access.log` | Every page, asset and `/api` request |

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Page doesn't load at all | `systemctl status nginx`; port 80 open in `sg-frontend`? Using `http://`, not `https://`? |
| Nginx welcome page shows | `default` site still enabled. Remove `/etc/nginx/sites-enabled/default`, then reload |
| `403 Forbidden` or blank page | `dist/` not copied: `ls /var/www/shoplite` should show `index.html` and `assets/` |
| Backend card **DOWN**, `HTTP 502` | Nginx reached the backend's IP but nothing listens on 5000: `systemctl status shoplite-backend` |
| Backend card **DOWN**, `HTTP 504` or long wait | Nginx can't reach the backend: `sg-backend` allows 5000 from `sg-frontend`? Right private IP in `proxy_pass`? Test with `curl http://BACKEND_PRIVATE_IP:5000/api/health` **on the frontend EC2** |
| Page shows a backend IP, or cards stuck on `…` | An old build is still deployed. Rebuild (`npm run build`) and re-copy `dist/` to `/var/www/shoplite`, then hard-refresh (Ctrl+Shift+R) |
| Backend card **DOWN**, products `HTTP 404`, and `curl -i localhost/api/health` says `Cannot GET /health` | `proxy_pass` has a trailing slash or path. It must be exactly `proxy_pass http://BACKEND_PRIVATE_IP:5000;` with nothing after the port |
| `nginx -t`: host not found in upstream | You didn't replace `BACKEND_PRIVATE_IP` in the config |
| Database **DOWN** with `ETIMEDOUT` | `sg-db` allows 3306 from `sg-backend`? `DB_HOST` is the DB's **private** IP? |
| Database **DOWN** with `ECONNREFUSED` | MySQL running? `bind-address = 0.0.0.0` set and MySQL restarted? |
| Database **DOWN** and backend log says `Database: localhost:3306` | The backend didn't get `DB_HOST`. Is `.env` in `/opt/shoplite-backend/` (next to `server.js`)? Line must be exactly `DB_HOST=172.31.x.x` (no spaces, quotes or `export`). Pulled the latest code and ran `npm install`? Then `sudo systemctl restart shoplite-backend` and check `journalctl -u shoplite-backend -n 5` for the `Database:` line |
| `ER_ACCESS_DENIED_ERROR` | `DB_USER`/`DB_PASSWORD` in backend `.env` match `create-user.sql`? |
| `ER_BAD_DB_ERROR` | `schema.sql` wasn't run on the DB server |
| Backend service won't start | `journalctl -u shoplite-backend -n 50`. Wrong `WorkingDirectory`? `npm install` skipped? |
| `nginx -t` fails | Read the line number it prints. Usually a missing `;` or `}` |
| `status=217/USER` | The unit runs as `User=ubuntu`. On Amazon Linux change it to `ec2-user` |

### Using Amazon Linux 2023 instead of Ubuntu

- Login user is `ec2-user`, so change `User=` in the backend `.service` file and the `chown` commands.
- `sudo dnf install -y nodejs npm git` for frontend and backend, plus `nginx` on the frontend.
- Nginx has no `sites-available` there: copy the config to `/etc/nginx/conf.d/shoplite.conf`
  and remove the default `server { ... }` block from `/etc/nginx/nginx.conf`.
- MySQL: `sudo dnf install -y mariadb105-server && sudo systemctl enable --now mariadb`.
  MariaDB works with this app unchanged. Its config file is `/etc/my.cnf.d/mariadb-server.cnf`.

---

## Run everything on one machine (for local testing)

```bash
# DB: have MySQL running locally, then
sudo mysql < database/schema.sql && sudo mysql < database/create-user.sql

# Backend
cd backend && npm install
DB_HOST=127.0.0.1 DB_PASSWORD='ChangeMe123!' node server.js

# Frontend (new terminal): Vite dev server with hot reload
cd frontend && npm install
npm run dev                # proxies /api to localhost:5000 (see vite.config.js)
# open http://localhost:5173
```

## Going further (later lessons)

- Add **HTTPS** with a domain name and Let's Encrypt (`certbot --nginx`).
- Move the backend into a **private subnet** behind an **ALB**, and point Nginx's `proxy_pass` at the ALB.
- Replace the DB EC2 with **Amazon RDS**.
- Store `DB_PASSWORD` in **SSM Parameter Store / Secrets Manager**.
- Automate all of this with **user data**, **Ansible**, or **Terraform**.
