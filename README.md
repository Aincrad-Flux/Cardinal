# Cardinal

Cardinal est un service de gestion de conteneurs Proxmox avec intégration Jenkins.

## Fonctionnalités

- Webhook pour recevoir les demandes de Jenkins
- Création automatique de conteneurs Proxmox
- Gestion sécurisée des accès aux conteneurs
- Sauvegarde et restauration automatiques
- Chiffrement des données sensibles

## Installation

1. Clonez le projet
2. Copiez `.env.example` vers `.env` et configurez vos variables
3. Installez les dépendances : `npm install`
4. Démarrez le serveur : `npm start`

## Configuration

Configurez le fichier `.env` avec vos paramètres Proxmox et autres configurations.

## Architecture

```
src/
├── controllers/    # Contrôleurs pour les routes
├── services/       # Services métier (Proxmox, Container, etc.)
├── models/         # Modèles de données
├── middleware/     # Middlewares Express
├── utils/          # Utilitaires (crypto, logger, etc.)
├── routes/         # Définition des routes
└── config/         # Configuration de l'application
```

## API

### Webhook Endpoints

- `POST /webhook/create-container` - Créer un nouveau conteneur
- `POST /webhook/get-access` - Obtenir l'accès à un conteneur

## Sécurité

- Toutes les données sensibles sont chiffrées
- Authentification par token pour les webhooks
- Logs sécurisés
