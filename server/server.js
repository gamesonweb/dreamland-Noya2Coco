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

// Middleware performance + sécurité
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "wss:"], // Autorise wss:// pour les WebSocket
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);

// 👉 Production : servir le client Vite buildé
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));

  // Fallback SPA (React / Vite)
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Endpoint de santé
app.get('/health', (req, res) => {
  res.status(200).send('Server is up and running!');
});

// Logger simple
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Token utilisateur (optionnel)
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

// WebSocket + logique de jeu
new Game(server);

// Démarrage Render ou local
const PORT = process.env.PORT || 22220;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP server running at http://0.0.0.0:${PORT}`);
  console.log(`✅ WebSocket server is ready to accept connections`);
});
