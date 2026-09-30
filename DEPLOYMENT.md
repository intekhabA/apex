# DiagnoLab — Production Deployment & Operations Guide

This guide describes how to deploy, configure, secure, and maintain DiagnoLab in a production environment using Docker Compose and Nginx reverse proxy.

---

## 1. System Requirements

- **Operating System**: Linux (Ubuntu 22.04 LTS or Debian 12 recommended)
- **CPU**: 2+ Cores (4+ Cores recommended for high-volume imaging centers)
- **RAM**: Minimum 4 GB (8 GB recommended for concurrent PDF rendering and database cache)
- **Disk Storage**: 50 GB+ SSD (with mounted block storage for `/app/storage` uploads)
- **Software**:
  - Docker Engine >= 24.0
  - Docker Compose >= 2.20
  - OpenSSL (for token & secret generation)

---

## 2. Pre-Deployment Configuration

### 2.1 Clone Repository and Prepare Environment
```bash
git clone https://github.com/your-org/diagnolab.git /opt/diagnolab
cd /opt/diagnolab
cp .env.example .env
```

### 2.2 Configure Production Variables in `.env`
Edit `.env` and set the following critical security parameters:

```bash
# Set production environment
ENVIRONMENT=production
DEBUG=False
APP_URL=https://diagnolab.yourdomain.com

# Cryptography: Generate strong random secrets
# openssl rand -hex 32
SECRET_KEY=9f8e7d6c5b4a3928170e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c

# Database credentials (MySQL)
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_USER=diagnolab_prod
MYSQL_PASSWORD=UltraSecureDbPassword_2026!
MYSQL_DATABASE=diagnolab_production
DATABASE_URL=mysql+aiomysql://diagnolab_prod:UltraSecureDbPassword_2026!@mysql:3306/diagnolab_production
SYNC_DATABASE_URL=mysql+pymysql://diagnolab_prod:UltraSecureDbPassword_2026!@mysql:3306/diagnolab_production

# Persistent storage mount
STORAGE_PROVIDER=local
STORAGE_LOCAL_ROOT=/app/storage

# Production Super Admin
INITIAL_SUPER_ADMIN_EMAIL=security@yourdomain.com
INITIAL_SUPER_ADMIN_PASSWORD=ProductionSuperAdminSecretKey!
```

---

## 3. Starting the Production Stack

Build and start all containerized services:
```bash
docker compose up --build -d
```

Verify that all 4 containers (`diagnolab-mysql`, `diagnolab-backend`, `diagnolab-frontend`, `diagnolab-nginx`) are running in a healthy state:
```bash
docker compose ps
```

---

## 4. Database Migrations & Initial Setup

Execute database schema migrations and run the initial data seeder:
```bash
# Run Alembic database migrations
docker compose exec backend alembic upgrade head

# Run seed script (creates initial super admin, test categories, and templates)
docker compose exec backend python -m app.db.seed
```

---

## 5. SSL/TLS Certificate Installation (Let's Encrypt / Certbot)

For production HTTPS, obtain and bind TLS certificates using Certbot.

1. Stop temporary Nginx port 80 binding:
   ```bash
   docker compose stop nginx
   ```

2. Request Let's Encrypt certificate:
   ```bash
   sudo certbot certonly --standalone -d diagnolab.yourdomain.com
   ```

3. Update `nginx/default.conf` to enable SSL termination on port 443 with modern ciphers:
   ```nginx
   server {
       listen 80;
       server_name diagnolab.yourdomain.com;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name diagnolab.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/diagnolab.yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/diagnolab.yourdomain.com/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;

       # Security Headers
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-Frame-Options "DENY" always;
       add_header X-XSS-Protection "1; mode=block" always;

       location / {
           proxy_pass http://frontend:5173;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /api/ {
           proxy_pass http://backend:8000/api/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. Mount certificate volumes in `docker-compose.yml` under `nginx` and restart:
   ```bash
   docker compose up -d nginx
   ```

---

## 6. Backup and Disaster Recovery

### Automated Daily Database Backup
Add a cron job on the host server:
```bash
0 2 * * * docker compose -f /opt/diagnolab/docker-compose.yml exec -T mysql mysqldump -u diagnolab_prod -pUltraSecureDbPassword_2026! --single-transaction --quick diagnolab_production | gzip > /opt/backups/diagnolab_db_$(date +\%Y\%m\%d).sql.gz
```

### Medical Report & Attachment Storage Backup
Sync the physical storage directory to secure off-site object storage (e.g. AWS S3 Glacier):
```bash
0 3 * * * aws s3 sync /opt/diagnolab/storage s3://your-lab-backup-bucket/storage/ --delete
```

### Database Restore Procedure
To restore from a backup file:
```bash
gunzip < /opt/backups/diagnolab_db_YYYYMMDD.sql.gz | docker compose exec -T mysql mysql -u diagnolab_prod -pUltraSecureDbPassword_2026! diagnolab_production
```

---

## 7. Monitoring & Health Probes

- **Liveness Probe**: `GET https://diagnolab.yourdomain.com/api/health` returns `{"status": "healthy"}`.
- **Audit Logs**: Queryable in the Admin UI under `/audit/logs` or via backend log streams:
  ```bash
  docker compose logs -f --tail=100 backend
  ```
