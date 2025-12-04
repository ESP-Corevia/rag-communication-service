# Guide de Déploiement AWS EC2 - Corevia IA Service

Ce guide détaille le déploiement professionnel de l'application sur AWS EC2.

## Table des matières
1. [Prérequis](#prérequis)
2. [Configuration AWS EC2](#configuration-aws-ec2)
3. [Installation de l'environnement](#installation-de-lenvironnement)
4. [Déploiement avec Docker](#déploiement-avec-docker)
5. [Déploiement avec PM2 (alternatif)](#déploiement-avec-pm2-alternatif)
6. [Configuration Nginx](#configuration-nginx)
7. [Sécurité et bonnes pratiques](#sécurité-et-bonnes-pratiques)
8. [Monitoring et logs](#monitoring-et-logs)
9. [Dépannage](#dépannage)

---

## Prérequis

- Compte AWS actif
- AWS CLI installé localement
- Clés SSH générées
- Nom de domaine (optionnel mais recommandé)
- Variables d'environnement (MISTRAL_API_KEY, PINECONE_API_KEY)

---

## Configuration AWS EC2

### 1. Créer une instance EC2

#### Via la console AWS:

1. **Se connecter à AWS Console**
   - Allez sur [AWS Console](https://console.aws.amazon.com)
   - Sélectionnez la région (ex: us-east-1)

2. **Lancer une instance EC2**
   - Service: EC2 ’ Launch Instance
   - **Nom**: `corevia-ia-service`
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Type d'instance**:
     - `t3.small` (2 vCPU, 2 GB RAM) - Recommandé pour production légère
     - `t3.medium` (2 vCPU, 4 GB RAM) - Recommandé pour production
     - `t2.micro` - Acceptable pour dev/test (Free Tier)

3. **Paire de clés (Key Pair)**
   ```bash
   # Si vous n'avez pas de clé, créez-en une:
   # - Nom: corevia-ia-key
   # - Type: RSA
   # - Format: .pem
   # Téléchargez et sécurisez:
   chmod 400 corevia-ia-key.pem
   mv corevia-ia-key.pem ~/.ssh/
   ```

4. **Configuration réseau**
   - Créer un nouveau Security Group: `corevia-ia-sg`
   - Règles de sécurité entrantes:

   | Type | Protocole | Port | Source | Description |
   |------|-----------|------|--------|-------------|
   | SSH | TCP | 22 | Votre IP | Accès SSH |
   | HTTP | TCP | 80 | 0.0.0.0/0 | Accès HTTP |
   | HTTPS | TCP | 443 | 0.0.0.0/0 | Accès HTTPS |
   | Custom TCP | TCP | 4000 | 0.0.0.0/0 | WebSocket (temporaire) |

5. **Configuration de stockage**
   - 20 GB GP3 SSD (minimum)
   - 30 GB recommandé pour logs et croissance

6. **Lancer l'instance**

### 2. Associer une IP Élastique (Elastic IP)

```bash
# Via AWS Console:
# EC2 ’ Elastic IPs ’ Allocate Elastic IP Address
# ’ Associate Elastic IP Address ’ Sélectionnez votre instance

# Via AWS CLI:
aws ec2 allocate-address --domain vpc
aws ec2 associate-address --instance-id i-xxxxx --allocation-id eipalloc-xxxxx
```

### 3. Connexion SSH

```bash
# Remplacez YOUR_ELASTIC_IP par l'IP de votre instance
ssh -i ~/.ssh/corevia-ia-key.pem ubuntu@YOUR_ELASTIC_IP

# Ou ajoutez une entrée dans ~/.ssh/config:
cat >> ~/.ssh/config << EOF
Host corevia-ec2
    HostName YOUR_ELASTIC_IP
    User ubuntu
    IdentityFile ~/.ssh/corevia-ia-key.pem
    ServerAliveInterval 60
EOF

# Puis connectez-vous simplement avec:
ssh corevia-ec2
```

---

## Installation de l'environnement

### 1. Mise à jour du système

```bash
# Connectez-vous à votre instance EC2
ssh corevia-ec2

# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des outils de base
sudo apt install -y curl wget git build-essential
```

### 2. Installation de Docker (Recommandé)

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Vérifier l'installation
docker --version
docker-compose --version

# Se déconnecter et reconnecter pour appliquer les changements de groupe
exit
ssh corevia-ec2
```

### 3. Installation de Node.js (Pour PM2 - Optionnel)

```bash
# Installer Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node --version
npm --version

# Installer PM2 globalement
sudo npm install -g pm2

# Configurer PM2 pour démarrer au boot
pm2 startup systemd
# Exécutez la commande affichée
```

### 4. Installation de Nginx

```bash
# Installer Nginx
sudo apt install -y nginx

# Démarrer et activer Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Vérifier le statut
sudo systemctl status nginx
```

---

## Déploiement avec Docker

### 1. Cloner le projet

```bash
# Créer le répertoire de l'application
sudo mkdir -p /opt/corevia-ia-service
sudo chown -R $USER:$USER /opt/corevia-ia-service

# Option A: Cloner depuis Git
cd /opt
git clone YOUR_GIT_REPOSITORY_URL corevia-ia-service
cd corevia-ia-service

# Option B: Transférer depuis votre machine locale
# Sur votre machine locale:
# rsync -avz -e "ssh -i ~/.ssh/corevia-ia-key.pem" \
#   --exclude 'node_modules' --exclude 'dist' \
#   ./ ubuntu@YOUR_ELASTIC_IP:/opt/corevia-ia-service/
```

### 2. Configuration des variables d'environnement

```bash
cd /opt/corevia-ia-service

# Créer le fichier .env
nano .env

# Copiez et modifiez avec vos vraies valeurs:
```

```env
# Server
PORT=4000
NODE_ENV=production

# Mistral AI
MISTRAL_API_KEY=your_actual_mistral_api_key_here

# Pinecone
PINECONE_API_KEY=your_actual_pinecone_api_key_here
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=corevia-medical

# Logging
LOG_LEVEL=info
```

```bash
# Sécuriser le fichier .env
chmod 600 .env
```

### 3. Construire et démarrer avec Docker

```bash
# Construire l'image
docker-compose build

# Démarrer les conteneurs
docker-compose up -d

# Vérifier que le conteneur fonctionne
docker ps

# Voir les logs
docker logs -f corevia-ia-service

# Tester le service
curl http://localhost:4000/health
```

### 4. Script de déploiement automatique

```bash
# Rendre le script exécutable
chmod +x scripts/deploy-ec2.sh

# Déployer
./scripts/deploy-ec2.sh production
```

---

## Déploiement avec PM2 (Alternatif)

Si vous préférez ne pas utiliser Docker:

### 1. Installation des dépendances

```bash
cd /opt/corevia-ia-service

# Installer les dépendances
npm ci --only=production

# Construire le projet
npm run build
```

### 2. Configuration PM2

```bash
# Créer le répertoire de logs
mkdir -p logs

# Démarrer avec PM2
pm2 start ecosystem.config.js --env production

# Sauvegarder la configuration PM2
pm2 save

# Vérifier le statut
pm2 status
pm2 logs corevia-ia-service

# Voir les métriques
pm2 monit
```

### 3. Commandes PM2 utiles

```bash
# Redémarrer l'application
pm2 restart corevia-ia-service

# Arrêter l'application
pm2 stop corevia-ia-service

# Voir les logs
pm2 logs corevia-ia-service --lines 100

# Recharger sans downtime
pm2 reload corevia-ia-service
```

---

## Configuration Nginx

### 1. Configurer Nginx comme reverse proxy

```bash
# Créer la configuration Nginx
sudo nano /etc/nginx/sites-available/corevia-ia-service
```

```nginx
# Copiez le contenu du fichier nginx/nginx.conf
# Ou utilisez directement:
sudo cp nginx/nginx.conf /etc/nginx/sites-available/corevia-ia-service
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/corevia-ia-service /etc/nginx/sites-enabled/

# Désactiver le site par défaut
sudo rm /etc/nginx/sites-enabled/default

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 2. Configuration SSL avec Let's Encrypt (Optionnel mais recommandé)

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir un certificat SSL (remplacez votre-domaine.com)
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com

# Le certificat sera automatiquement renouvelé
# Tester le renouvellement automatique:
sudo certbot renew --dry-run
```

### 3. Mettre à jour le Security Group

```bash
# Dans AWS Console:
# EC2 ’ Security Groups ’ corevia-ia-sg
# Supprimez ou restreignez la règle pour le port 4000
# Tout le trafic doit maintenant passer par Nginx (ports 80/443)
```

---

## Sécurité et bonnes pratiques

### 1. Pare-feu UFW

```bash
# Activer UFW
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Vérifier le statut
sudo ufw status
```

### 2. Fail2ban pour SSH

```bash
# Installer Fail2ban
sudo apt install -y fail2ban

# Configurer
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Démarrer et activer
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 3. Sauvegardes automatiques

```bash
# Créer un script de backup
sudo nano /usr/local/bin/backup-corevia.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/corevia"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup de l'application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /opt/corevia-ia-service \
  --exclude='node_modules' --exclude='dist'

# Backup des logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /opt/corevia-ia-service/logs

# Nettoyer les anciennes sauvegardes (>7 jours)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Rendre exécutable
sudo chmod +x /usr/local/bin/backup-corevia.sh

# Ajouter au cron (tous les jours à 2h du matin)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-corevia.sh") | crontab -
```

### 4. Monitoring système

```bash
# Installer htop et iotop
sudo apt install -y htop iotop

# Configurer des alertes (optionnel)
sudo apt install -y monit
```

---

## Monitoring et logs

### 1. Logs Docker

```bash
# Voir les logs en temps réel
docker logs -f corevia-ia-service

# Dernières 100 lignes
docker logs --tail 100 corevia-ia-service

# Logs avec timestamp
docker logs -t corevia-ia-service
```

### 2. Logs PM2

```bash
# Logs en temps réel
pm2 logs corevia-ia-service

# Logs d'erreur uniquement
pm2 logs corevia-ia-service --err

# Vider les logs
pm2 flush
```

### 3. Logs Nginx

```bash
# Access logs
sudo tail -f /var/log/nginx/corevia_access.log

# Error logs
sudo tail -f /var/log/nginx/corevia_error.log

# Analyser les logs
sudo tail -100 /var/log/nginx/corevia_access.log | grep -i error
```

### 4. Logs système

```bash
# Journaux système
sudo journalctl -u nginx -f
sudo journalctl -u docker -f

# Utilisation disque
df -h

# Utilisation mémoire
free -h

# Processus
top
htop
```

---

## Dépannage

### Le service ne démarre pas

```bash
# Vérifier les logs
docker logs corevia-ia-service

# Vérifier que le port est libre
sudo netstat -tulpn | grep 4000

# Vérifier les variables d'environnement
docker exec corevia-ia-service env
```

### Problèmes de connexion WebSocket

```bash
# Vérifier la configuration Nginx
sudo nginx -t

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/corevia_error.log

# Tester la connexion WebSocket
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Host: localhost" \
  -H "Origin: http://localhost" \
  http://localhost/socket.io/
```

### Problèmes de mémoire

```bash
# Vérifier l'utilisation mémoire
docker stats corevia-ia-service

# Augmenter la limite mémoire dans docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 1G
```

### Redémarrage après crash

```bash
# Docker redémarre automatiquement (restart: unless-stopped)
# Pour PM2:
pm2 resurrect

# Pour forcer un redémarrage complet:
docker-compose down && docker-compose up -d
```

---

## Commandes utiles

```bash
# Docker
docker ps                                    # Liste des conteneurs
docker logs -f corevia-ia-service           # Logs en temps réel
docker exec -it corevia-ia-service sh       # Accès au conteneur
docker-compose restart                       # Redémarrer
docker-compose down && docker-compose up -d # Redémarrage complet
docker system prune -a                       # Nettoyer Docker

# PM2
pm2 status                                   # Statut
pm2 restart corevia-ia-service              # Redémarrer
pm2 logs corevia-ia-service --lines 100     # Logs
pm2 monit                                    # Monitoring
pm2 delete corevia-ia-service               # Supprimer

# Nginx
sudo nginx -t                                # Tester config
sudo systemctl reload nginx                  # Recharger
sudo systemctl restart nginx                 # Redémarrer
sudo tail -f /var/log/nginx/corevia_error.log # Logs

# Système
df -h                                        # Espace disque
free -h                                      # Mémoire
htop                                         # Processus
sudo ufw status                              # Firewall
```

---

## Mises à jour

### Mettre à jour l'application

```bash
# Option 1: Avec Docker
cd /opt/corevia-ia-service
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Option 2: Avec PM2
cd /opt/corevia-ia-service
git pull origin main
npm ci --only=production
npm run build
pm2 reload ecosystem.config.js
```

---

## Support

Pour toute question ou problème:
- Consultez les logs
- Vérifiez la configuration des variables d'environnement
- Assurez-vous que les ports sont correctement ouverts dans le Security Group

---

**Bon déploiement! =€**
