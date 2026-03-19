import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { tasksRouter } from './routes/tasks.js';
import { adminRouter } from './routes/admin.js';
import { mvpRouter } from './routes/mvp.js';
// import { pushRouter } from './routes/push.js';
// import { setupNotifications } from './notifications.js';

dotenv.config();

const prisma = new PrismaClient();

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

async function ensureMvpMonths() {
  try {
    const count = await prisma.mvpMonth.count();
    if (count === 0) {
      const year = new Date().getFullYear();
      for (let m = 1; m <= 12; m++) {
        const ym = `${year}-${String(m).padStart(2, '0')}`;
        await prisma.mvpMonth.upsert({
          where: { yearMonth: ym },
          update: {},
          create: { yearMonth: ym, sortOrder: m - 1 },
        });
      }
      console.log(`Created 12 MvpMonth records for ${year}`);
    }
  } catch (e) {
    console.error('Failed to seed MvpMonth:', e);
  }
}

app.listen(PORT, async () => {
  console.log(`TaskPulse → http://localhost:${PORT}`);
  await ensureMvpMonths();
  // setupNotifications();
});
