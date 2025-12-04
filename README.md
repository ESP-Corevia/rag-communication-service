# 🏥 Corevia IA Service

Microservice IA pour Corevia avec architecture RAG (Retrieval-Augmented Generation) utilisant Mistral AI et Pinecone.

## 🎯 Fonctionnalités

- **WebSocket Server** avec Socket.io pour communication en temps réel
- **Agent Médecin Généraliste** avec disclaimers médicaux stricts
- **RAG (Retrieval-Augmented Generation)** avec Pinecone pour contexte médical
- **Streaming de réponses** token par token avec Mistral AI
- **Détection d'urgence** automatique avec réponse immédiate
- **Architecture extensible** pour ajouter de nouveaux agents

## 📦 Stack Technique

- **Node.js** + **TypeScript**
- **NestJS** - Framework backend
- **Socket.io** - WebSocket pour communication temps réel
- **Mistral AI** - LLM (mistral-large-latest + mistral-embed)
- **Pinecone** - Base de données vectorielle pour RAG
- **Winston** - Logger
- **Zod** - Validation des variables d'environnement
- **Docker** + **docker-compose**

## 🚀 Installation

### Prérequis

- Node.js 20+
- npm ou yarn
- Compte Mistral AI (clé API)
- Compte Pinecone (clé API + index créé)

### 1. Cloner et installer

```bash
cd corevia-ia-service
npm install
```

### 2. Configuration

Copier `.env.example` vers `.env` et remplir les valeurs :

```bash
cp .env.example .env
```

Éditer `.env` :

```env
PORT=3000
NODE_ENV=development

MISTRAL_API_KEY=votre_cle_mistral_ai
PINECONE_API_KEY=votre_cle_pinecone
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=corevia-medecin-generaliste

LOG_LEVEL=info
```

### 3. Créer l'index Pinecone

Avant de lancer le service, créez l'index dans Pinecone :

- **Nom** : `corevia-medecin-generaliste`
- **Dimensions** : 1024 (pour mistral-embed)
- **Metric** : cosine
- **Namespace** : `medical-knowledge`

### 4. Lancer en développement

```bash
npm run dev
```

Le serveur sera disponible sur `ws://localhost:3000`

## 🐳 Docker

### Build et lancement

```bash
docker-compose up --build
```

### Arrêt

```bash
docker-compose down
```

### Logs

```bash
docker-compose logs -f corevia-ia-service
```

## 📡 Utilisation WebSocket

### Connexion

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000');

socket.on('connect', () => {
  console.log('Connected to Corevia IA Service');
});
```

### Envoyer une requête

```javascript
socket.emit('query', {
  type: 'query',
  agent: 'medecin_generaliste',
  query: 'J\'ai mal à la tête depuis ce matin',
  userId: 'user123'
});
```

### Recevoir les réponses

```javascript
socket.on('message', (data) => {
  switch (data.type) {
    case 'chunk':
      // Token reçu en streaming
      console.log(data.content);
      break;

    case 'done':
      // Réponse complète
      console.log('Response finished');
      break;

    case 'error':
      // Erreur
      console.error(data.message);
      break;
  }
});
```

## 🤖 Agents Disponibles

### 1. Agent Médecin Généraliste (`medecin_generaliste`)

Agent médical avec :

- ⚠️ **Disclaimers obligatoires** : rappelle qu'il n'est pas un vrai médecin
- 🚨 **Détection d'urgence** : mots-clés comme "douleur thoracique", "difficulté à respirer"
- 📚 **RAG activé** : récupération de contexte médical depuis Pinecone
- 🩺 **Redirection vers professionnels** : recommande de consulter si nécessaire

#### Exemple d'urgence

**Input :**
```
"J'ai une douleur à la poitrine"
```

**Output immédiat :**
```
🚨 URGENCE MÉDICALE DÉTECTÉE

Appelez immédiatement le 15 (SAMU) ou le 112 (numéro d'urgence européen).
...
```

## 🏗️ Architecture

```
corevia-ia-service/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.module.ts            # NestJS module
│   ├── config/
│   │   ├── env.ts              # Environment validation
│   │   └── prompts.ts          # System prompts
│   ├── services/
│   │   ├── llm.service.ts      # Mistral AI client
│   │   ├── pinecone.service.ts # Pinecone RAG
│   │   └── websocket.service.ts # WebSocket gateway
│   ├── agents/
│   │   ├── base.agent.ts       # Base class
│   │   └── medecin.agent.ts    # Médecin agent
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   └── utils/
│       └── logger.ts           # Winston logger
```

## 🔧 Développement

### Ajouter un nouvel agent

1. Créer une classe dans `src/agents/` qui étend `BaseAgent`
2. Implémenter les méthodes abstraites :
   - `getSystemPrompt()`
   - `detectUrgency()`
   - `getUrgencyResponse()`
3. Ajouter le prompt dans `src/config/prompts.ts`
4. Enregistrer l'agent dans `src/app.module.ts`
5. Enregistrer l'agent dans `WebSocketService`

### Exemple : Agent Nutritionniste

```typescript
// src/agents/nutritionniste.agent.ts
import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';

@Injectable()
export class NutritionnisteAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return NUTRITIONNISTE_PROMPT;
  }

  protected detectUrgency(query: string): boolean {
    // Pas d'urgence pour nutrition
    return false;
  }

  protected getUrgencyResponse(): string {
    return '';
  }
}
```

## 📊 RAG Flow

```
1. User Query
   ↓
2. Generate Embedding (Mistral Embed)
   ↓
3. Pinecone Similarity Search (top 5, score > 0.7)
   ↓
4. If contexts found → Inject into prompt
   ↓
5. Mistral Large Generation (streaming)
   ↓
6. Stream tokens via WebSocket
```

## 🔒 Sécurité Médicale

### Disclaimers automatiques

L'agent rappelle systématiquement :
- ❌ Il n'est PAS un médecin
- 📋 Ses conseils sont informatifs uniquement
- 🏥 Toujours consulter un professionnel
- 🚨 Appeler les urgences si nécessaire

### Mots-clés d'urgence

Le système détecte automatiquement :
- Douleur thoracique / poitrine
- Difficulté à respirer
- Perte de conscience
- Saignement important
- Douleur abdominale intense
- Symptômes d'AVC
- Pensées suicidaires

## 📝 Logs

Les logs sont stockés dans `logs/` :
- `combined.log` : Tous les logs
- `error.log` : Erreurs uniquement

Format :
```
2024-01-15 14:23:45 [INFO]: Client connected: abc123
2024-01-15 14:23:47 [INFO]: Received query from user user123: J'ai mal à la tête...
2024-01-15 14:23:50 [INFO]: Query processed successfully for user user123
```

## 🧪 Test Client

Créer un fichier `test-client.html` :

```html
<!DOCTYPE html>
<html>
<head>
  <title>Corevia IA Test Client</title>
  <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
</head>
<body>
  <h1>Corevia IA Test Client</h1>
  <input id="query" type="text" placeholder="Votre question médicale..." />
  <button onclick="sendQuery()">Envoyer</button>
  <pre id="response"></pre>

  <script>
    const socket = io('http://localhost:3000');
    let response = '';

    socket.on('connect', () => {
      console.log('Connected');
    });

    socket.on('message', (data) => {
      if (data.type === 'chunk') {
        response += data.content;
        document.getElementById('response').textContent = response;
      } else if (data.type === 'done') {
        console.log('Done');
      } else if (data.type === 'error') {
        console.error(data.message);
      }
    });

    function sendQuery() {
      response = '';
      const query = document.getElementById('query').value;
      socket.emit('query', {
        type: 'query',
        agent: 'medecin_generaliste',
        query: query,
        userId: 'test-user'
      });
    }
  </script>
</body>
</html>
```

## 🚀 Déploiement sur AWS EC2

Ce projet est prêt pour un déploiement professionnel sur AWS EC2. Consultez le guide détaillé :

**[📖 Guide de Déploiement AWS EC2](DEPLOYMENT.md)**

### Quick Start

1. **Lancer une instance EC2 Ubuntu 22.04**
2. **Se connecter via SSH**
3. **Installer Docker et Docker Compose**
4. **Cloner le projet et configurer les variables d'environnement**
5. **Déployer avec le script automatique :**

```bash
./scripts/deploy-ec2.sh production
```

Le guide complet couvre :
- Configuration EC2 et Security Groups
- Installation de l'environnement (Docker, Node.js, Nginx)
- Déploiement avec Docker ou PM2
- Configuration Nginx comme reverse proxy
- SSL/HTTPS avec Let's Encrypt
- Sécurité et bonnes pratiques
- Monitoring et gestion des logs
- Dépannage

### Fichiers de déploiement disponibles

- [Dockerfile](Dockerfile) - Image Docker optimisée multi-stage
- [docker-compose.yml](docker-compose.yml) - Configuration Docker Compose
- [nginx/nginx.conf](nginx/nginx.conf) - Configuration Nginx avec WebSocket
- [ecosystem.config.js](ecosystem.config.js) - Configuration PM2
- [scripts/deploy-ec2.sh](scripts/deploy-ec2.sh) - Script de déploiement automatique

## 🚧 TODO / Améliorations futures

- [ ] Rate limiting par utilisateur
- [ ] Authentification JWT
- [ ] Métriques avec Prometheus
- [ ] Cache Redis pour réponses fréquentes
- [ ] Historique des conversations
- [ ] Support multilingue
- [ ] Tests unitaires et e2e
- [ ] CI/CD avec GitHub Actions

## 📄 Licence

MIT

## 👥 Auteurs

Corevia Team

---

**⚠️ IMPORTANT** : Ce service est destiné à des fins informatives uniquement. Il ne remplace pas un avis médical professionnel.
