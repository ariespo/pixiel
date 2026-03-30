import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import routes
import chatRoutes from './routes/chat';
import presetRoutes from './routes/presets';
import musicRoutes from './routes/music';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve Imported_Preset.json for auto-import
app.get('/Imported_Preset.json', (req, res) => {
  const presetPath = path.join(process.cwd(), 'Imported_Preset.json');
  if (fs.existsSync(presetPath)) {
    res.sendFile(presetPath);
  } else {
    res.status(404).json({ error: 'Preset file not found' });
  }
});

// API routes
app.use('/api/chat', chatRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/music', musicRoutes);

// Production mode: serve static files from dist folder
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  console.log('[Server] Production mode: serving static files from ./dist');
  app.use(express.static(distPath));

  // SPA fallback: all non-API routes serve index.html
  app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'index.html not found. Please run npm run build first.' });
    }
  });
} else {
  // Development mode: 404 for non-API routes
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      hint: 'Frontend not built. Run "npm run build" for production, or use "npm start" for development.'
    });
  });
}

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error'
  });
});

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`  Terminal Care Server`);
  console.log(`=================================`);
  console.log(`API Server: http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  - Chat:    http://localhost:${PORT}/api/chat`);
  console.log(`  - Presets: http://localhost:${PORT}/api/presets`);
  console.log(`  - Music:   http://localhost:${PORT}/api/music`);
  console.log(`  - Health:  http://localhost:${PORT}/health`);

  if (fs.existsSync(distPath)) {
    console.log(`\nFrontend:   http://localhost:${PORT} (production mode)`);
  } else {
    console.log(`\nFrontend:   Run "npm run dev" separately (development mode)`);
    console.log(`            Or use "npm start" to run both concurrently`);
  }
  console.log(`=================================`);
});

export default app;
