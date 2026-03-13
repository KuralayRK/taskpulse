import cron from 'node-cron';
import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function setupNotifications() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || 'mailto:admin@taskpulse.app';

  if (!publicKey || !privateKey) {
    console.log('VAPID keys not set — push notifications disabled');
    return;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);

  // Every day at 09:15
  cron.schedule('15 9 * * *', async () => {
    console.log('[cron] Checking deadlines for push notifications...');
    await sendDeadlineAlerts();
  });

  console.log('Push notifications scheduled at 09:15 daily');
}

async function sendDeadlineAlerts() {
  try {
    const now = new Date();
    const in3days = new Date(now);
    in3days.setDate(in3days.getDate() + 3);
    in3days.setHours(23, 59, 59, 999);

    const tasks = await prisma.task.findMany({
      where: {
        status: { not: 'done' },
        deadline: { lte: in3days },
      },
      include: { assignee: true },
      orderBy: { deadline: 'asc' },
    });

    if (tasks.length === 0) return;

    const overdue = tasks.filter((t) => new Date(t.deadline) < now);
    const upcoming = tasks.filter((t) => new Date(t.deadline) >= now);

    const lines: string[] = [];
    if (overdue.length > 0) {
      lines.push(`🔴 Просрочено: ${overdue.length}`);
    }
    if (upcoming.length > 0) {
      lines.push(`🟡 Скоро дедлайн: ${upcoming.length}`);
    }

    const topTasks = tasks.slice(0, 3).map((t) => {
      const d = new Date(t.deadline);
      const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const when = diff < 0 ? `просрочено ${Math.abs(diff)}д` : diff === 0 ? 'сегодня' : `через ${diff}д`;
      return `• ${t.title} (${when})`;
    });

    const payload = JSON.stringify({
      title: `TaskPulse: ${tasks.length} задач требуют внимания`,
      body: [...lines, '', ...topTasks].join('\n'),
      url: '/dashboard',
    });

    const subscriptions = await prisma.pushSubscription.findMany();
    
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    console.log(`[cron] Sent push to ${subscriptions.length} subscribers about ${tasks.length} tasks`);
  } catch (e) {
    console.error('[cron] Failed to send notifications:', e);
  }
}
