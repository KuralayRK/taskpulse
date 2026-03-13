import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(18, 0, 0, 0);
  return d;
}

async function main() {
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.person.deleteMany();

  const ivan = await prisma.person.create({ data: { name: 'Иван', email: 'ivan@company.com' } });
  const dima = await prisma.person.create({ data: { name: 'Дима', email: 'dima@company.com' } });
  const anya = await prisma.person.create({ data: { name: 'Аня', email: 'anya@company.com' } });
  const olga = await prisma.person.create({ data: { name: 'Ольга', email: 'olga@company.com' } });

  const t1 = await prisma.task.create({
    data: {
      title: 'API интеграция с банком',
      description: 'Подключить платёжный шлюз через API банка для приёма онлайн-оплат',
      deadline: daysFromNow(-4),
      priority: 'high',
      status: 'in_progress',
      assigneeId: ivan.id,
    },
  });

  const t2 = await prisma.task.create({
    data: {
      title: 'Подписание акта ООО "Ромашка"',
      description: 'Получить подписанный акт выполненных работ от клиента',
      deadline: daysFromNow(-2),
      priority: 'medium',
      status: 'todo',
      assigneeId: olga.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Релиз v2.3',
      description: 'Финальное тестирование, код-ревью и деплой на продакшен',
      deadline: daysFromNow(1),
      priority: 'high',
      status: 'in_progress',
      assigneeId: dima.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Демо клиенту',
      description: 'Подготовить и провести демонстрацию новых фич заказчику',
      deadline: daysFromNow(3),
      priority: 'medium',
      status: 'todo',
      assigneeId: ivan.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Обновить документацию',
      description: 'Обновить README, API docs и пользовательский гайд',
      deadline: daysFromNow(14),
      priority: 'low',
      status: 'todo',
      assigneeId: anya.id,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Рефакторинг модуля оплат',
      description: 'Переписать модуль оплат на новую архитектуру с поддержкой нескольких провайдеров',
      deadline: daysFromNow(20),
      priority: 'medium',
      status: 'todo',
      assigneeId: dima.id,
    },
  });

  await prisma.comment.create({
    data: {
      taskId: t1.id,
      authorName: 'Иван',
      content: 'Отправил запрос на доступы к тестовому стенду банка. Ждём ответ от их IT-отдела.',
    },
  });

  await prisma.comment.create({
    data: {
      taskId: t1.id,
      authorName: 'Иван',
      content: 'Банк до сих пор не выдал доступы, написал повторно. Без них не могу продолжить.',
    },
  });

  await prisma.comment.create({
    data: {
      taskId: t2.id,
      authorName: 'Ольга',
      content: 'Жду скан подписанного акта от клиента, обещал прислать сегодня.',
    },
  });

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
