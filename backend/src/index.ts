import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { tasksRouter } from './routes/tasks.js';
import { adminRouter } from './routes/admin.js';
import { mvpRouter } from './routes/mvp.js';
// import { pushRouter } from './routes/push.js';
// import { setupNotifications } from './notifications.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// MVP: health сразу в app, чтобы ответил даже если роутер не подхватился
app.get('/api/mvp/health', (_req, res) => {
  res.json({ ok: true, mvp: true, from: 'index' });
});

// MVP отдельным mount — полные пути /api/mvp/board, /api/mvp/items/…
app.use('/api/mvp', mvpRouter);
app.use('/api', tasksRouter);
app.use('/api/admin', adminRouter);
// app.use('/api', pushRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TaskPulse → http://localhost:${PORT}`);
  console.log(`MVP:      GET http://localhost:${PORT}/api/mvp/health  и  /api/mvp/board`);
  console.log(`          (если этой строки нет в терминале — крутится СТАРЫЙ процесс; заверши его и запусти снова: npm run dev)`);
  // setupNotifications();
});
