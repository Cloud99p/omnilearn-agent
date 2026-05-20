# Oracle Cloud Free Tier Setup Guide

**Primary Backup** — 4 CPU, 24GB RAM, 200GB storage (always free)

---

## Step 1: Sign Up

1. Go to https://cloud.oracle.com
2. Click "Start for free"
3. Create account (email + password)
4. Choose home region (recommend: **Frankfurt** or **Amsterdam** — closest to Nigeria with availability)
5. Complete phone verification

---

## Step 2: Create Compute Instance

1. **Console → Compute → Instances**
2. Click "Create instance"
3. **Configuration:**
   - **Name:** `omnilearn-api`
   - **Compartment:** Root compartment
   - **Availability domain:** Any (pick one with capacity)
   - **Image:** Ubuntu 22.04 (aarch64)
   - **Shape:** VM.Standard.A1.Flex (always free)
     - OCPUs: 4
     - Memory: 24 GB
   - **Networking:**
     - VCN: Create new
     - Subnet: Public
     - Assign public IPv4: ✅ Yes
   - **SSH keys:** 
     - Generate key pair OR upload your public key
     - Download private key if generated
   - **Boot volume:** 200GB (default)

4. Click "Create"
5. Wait 2-3 minutes for instance to start

---

## Step 3: SSH Into Server

```bash
# Save your private key
chmod 600 ~/Downloads/omnilearn-key.pem

# SSH into server
ssh -i ~/Downloads/omnilearn-key.pem ubuntu@<your-public-ip>
```

---

## Step 4: Install Dependencies

Run this script on the server:

```bash
#!/bin/bash
# save as setup.sh, then: chmod +x setup.sh && ./setup.sh

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
source ~/.bashrc

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL (optional - if hosting DB locally)
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Configure PostgreSQL
sudo -u postgres psql << EOF
CREATE DATABASE omnilearn;
CREATE USER omnilearn WITH PASSWORD 'your-secure-password-here';
GRANT ALL PRIVILEGES ON DATABASE omnilearn TO omnilearn;
EOF

# Install Nginx (reverse proxy)
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Configure firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

echo "✅ Setup complete!"
echo "Node.js: $(node -v)"
echo "pnpm: $(pnpm -v)"
echo "PM2: $(pm2 -v)"
echo "PostgreSQL: $(psql --version)"
```

---

## Step 5: Clone & Deploy

```bash
# Clone your repo
cd /home/ubuntu
git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent

# Install dependencies
pnpm install

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://omnilearn:your-secure-password-here@localhost:5432/omnilearn
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
PORT=3000
NODE_ENV=production
EOF

# Start with PM2
cd artifacts/api-server
pm2 start src/index.ts --name omnilearn-api
pm2 save
pm2 startup

# Copy the PM2 startup command it outputs and run it
# Example: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## Step 6: Configure Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/omnilearn
```

Paste this config:

```nginx
server {
    listen 80;
    server_name <your-domain-or-ip>;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/omnilearn /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 7: Deploy Script (For Future Updates)

Create `deploy.sh` in your repo root:

```bash
#!/bin/bash
# deploy.sh - Run this on Oracle Cloud server

set -e

echo "🚀 Deploying OmniLearn..."

cd /home/ubuntu/omnilearn-agent

# Pull latest changes
git pull origin main

# Install dependencies
pnpm install

# Restart API
cd artifacts/api-server
pm2 restart omnilearn-api

# Save PM2 process list
pm2 save

echo "✅ Deployment complete!"
echo "Check logs: pm2 logs omnilearn-api"
```

Make it executable:
```bash
chmod +x deploy.sh
```

---

## Step 8: SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate (if you have a domain)
sudo certbot --nginx -d your-domain.com

# Auto-renewal is automatic (Certbot sets up cron job)
```

---

## Monitoring & Management

```bash
# View logs
pm2 logs omnilearn-api

# View status
pm2 status

# Restart
pm2 restart omnilearn-api

# Stop
pm2 stop omnilearn-api

# View memory/CPU
pm2 monit

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
```

---

## Cost Breakdown

| Resource | Cost |
|----------|------|
| 4 OCPU ARM VM | FREE (always free tier) |
| 24GB RAM | FREE (always free tier) |
| 200GB Storage | FREE (always free tier) |
| Public IP | FREE |
| Data Transfer | FREE (10TB/month outbound) |
| **Total** | **$0/month** |

---

## Troubleshooting

### Can't SSH
```bash
# Check security list in Oracle Console
# Networking → Virtual Cloud Networks → Security Lists
# Ensure port 22 is open to 0.0.0.0/0
```

### PostgreSQL Won't Start
```bash
sudo systemctl status postgresql
sudo journalctl -u postgresql
```

### PM2 Process Crashes
```bash
pm2 logs omnilearn-api --lines 100
pm2 restart omnilearn-api
```

### Nginx 502 Bad Gateway
```bash
# Check if API is running
pm2 status

# Check Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Backup Strategy

```bash
# Create backup script
cat > /home/ubuntu/backup.sh << 'EOF'
#!/bin/bash
# Backup PostgreSQL database
pg_dump -U omnilearn omnilearn > /home/ubuntu/backups/omnilearn-$(date +%Y%m%d).sql

# Keep only last 7 days
find /home/ubuntu/backups -name "*.sql" -mtime +7 -delete
EOF

chmod +x /home/ubuntu/backup.sh

# Add to crontab (daily at 3 AM)
crontab -e
# Add: 0 3 * * * /home/ubuntu/backup.sh
```

---

**Next Step:** Run the setup script on your Oracle Cloud instance, then test deployment!
