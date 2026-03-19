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
  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.mvpItem.deleteMany();
  await prisma.mvpMonth.deleteMany();
  await prisma.product.deleteMany();
  await prisma.person.deleteMany();
  await prisma.direction.deleteMany();

  const ivan = await prisma.person.create({ data: { name: 'Иван', email: 'ivan@company.com' } });
  const dima = await prisma.person.create({ data: { name: 'Дима', email: 'dima@company.com' } });
  const anya = await prisma.person.create({ data: { name: 'Аня', email: 'anya@company.com' } });
  const olga = await prisma.person.create({ data: { name: 'Ольга', email: 'olga@company.com' } });

  const dirDev = await prisma.direction.create({ data: { name: 'Разработка' } });
  const dirBiz = await prisma.direction.create({ data: { name: 'Бизнес' } });
  const dirDocs = await prisma.direction.create({ data: { name: 'Документация' } });

  const t1 = await prisma.task.create({
    data: {
      title: 'API интеграция с банком',
      description: 'Подключить платёжный шлюз через API банка для приёма онлайн-оплат',
      startDate: daysFromNow(-14),
      deadline: daysFromNow(-4),
      priority: 'high',
      status: 'in_progress',
      directionId: dirDev.id,
      assignees: { create: [{ personId: ivan.id }, { personId: dima.id }] },
    },
  });

  const t2 = await prisma.task.create({
    data: {
      title: 'Подписание акта ООО "Ромашка"',
      description: 'Получить подписанный акт выполненных работ от клиента',
      startDate: daysFromNow(-7),
      deadline: daysFromNow(-2),
      priority: 'medium',
      status: 'todo',
      directionId: dirBiz.id,
      assignees: { create: [{ personId: olga.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Релиз v2.3',
      description: 'Финальное тестирование, код-ревью и деплой на продакшен',
      startDate: daysFromNow(-3),
      deadline: daysFromNow(1),
      priority: 'high',
      status: 'in_progress',
      directionId: dirDev.id,
      assignees: { create: [{ personId: dima.id }, { personId: anya.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Демо клиенту',
      description: 'Подготовить и провести демонстрацию новых фич заказчику',
      startDate: daysFromNow(0),
      deadline: daysFromNow(3),
      priority: 'medium',
      status: 'todo',
      directionId: dirBiz.id,
      assignees: { create: [{ personId: ivan.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Обновить документацию',
      description: 'Обновить README, API docs и пользовательский гайд',
      startDate: daysFromNow(2),
      deadline: daysFromNow(14),
      priority: 'low',
      status: 'todo',
      directionId: dirDocs.id,
      assignees: { create: [{ personId: anya.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Рефакторинг модуля оплат',
      description: 'Переписать модуль оплат на новую архитектуру',
      startDate: daysFromNow(5),
      deadline: daysFromNow(20),
      priority: 'medium',
      status: 'todo',
      directionId: dirDev.id,
      assignees: { create: [{ personId: dima.id }, { personId: ivan.id }, { personId: anya.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: 'Провести ретроспективу',
      priority: 'low',
      status: 'todo',
      assignees: { create: [{ personId: olga.id }] },
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
      taskId: t2.id,
      authorName: 'Ольга',
      content: 'Жду скан подписанного акта от клиента, обещал прислать сегодня.',
    },
  });

  // MVP: months, products, epics
  const months: { id: number; yearMonth: string }[] = [];
  for (let m = 1; m <= 12; m++) {
    const ym = `2026-${String(m).padStart(2, '0')}`;
    const mo = await prisma.mvpMonth.create({ data: { yearMonth: ym, sortOrder: m - 1 } });
    months.push(mo);
  }

  const prodWeb = await prisma.product.create({ data: { name: 'Веб-сайт', directionId: dirDev.id } });
  const prodAndroid = await prisma.product.create({ data: { name: 'Android', directionId: dirDev.id } });
  const prodIos = await prisma.product.create({ data: { name: 'iOS', directionId: dirDev.id } });
  const prodCrm = await prisma.product.create({ data: { name: 'CRM', directionId: dirBiz.id } });

  await prisma.mvpItem.create({ data: { title: 'Редизайн главной', monthId: months[0].id, endMonthId: months[2].id, productId: prodWeb.id } });
  await prisma.mvpItem.create({ data: { title: 'Авторизация', monthId: months[1].id, endMonthId: months[2].id, productId: prodAndroid.id } });
  await prisma.mvpItem.create({ data: { title: 'Push-уведомления', monthId: months[2].id, endMonthId: months[4].id, productId: prodAndroid.id } });
  await prisma.mvpItem.create({ data: { title: 'Авторизация iOS', monthId: months[1].id, endMonthId: months[3].id, productId: prodIos.id } });
  await prisma.mvpItem.create({ data: { title: 'App Store релиз', monthId: months[3].id, endMonthId: months[4].id, productId: prodIos.id } });
  await prisma.mvpItem.create({ data: { title: 'Интеграция с банком', monthId: months[2].id, endMonthId: months[3].id, productId: prodCrm.id } });
  await prisma.mvpItem.create({ data: { title: 'Личный кабинет v2', monthId: months[4].id, endMonthId: months[6].id, productId: prodWeb.id } });
  await prisma.mvpItem.create({ data: { title: 'Аналитика', monthId: months[5].id, productId: prodCrm.id } });

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
