import express from 'express';
import { createServer } from 'http';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { Game } from './game.js';

const app = express();
const server = createServer(app);

// Utilitaires pour __dirname dans module ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware de performance et sécurité
app.use(compression());
app.use(helmet());

// 👉 Production : servir les fichiers buildés de Vite
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));

  // ⚠️ Fallback SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Endpoint de santé
app.get('/health', (req, res) => {
  res.status(200).send('Server is up and running!');
});

// Log simple
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Vérification de token utilisateur
app.use((req, res, next) => {
  const token = req.query.token || req.headers['x-user-token'];
  if (token) {
    console.log(`🔑 Token utilisateur reçu: ${token}`);
    req.userToken = token;
  } else {
    console.warn("⚠️ Aucun token utilisateur reçu.");
  }
  next();
});

// Lancer la WebSocket + logique jeu
new Game(server);

// Écoute sur Render
const PORT = process.env.PORT || 22220;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server running at http://0.0.0.0:${PORT}`);
  console.log(`✅ WebSocket server is ready to accept connections`);
});
