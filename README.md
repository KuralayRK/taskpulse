# TaskPulse

Трекер дедлайнов для команды. Вы управляете задачами с ноутбука, команда смотрит с телефона.

## Быстрый старт (локально)

```bash
npm run setup   # установка зависимостей + создание БД с демо-данными
npm run dev     # запуск (бэкенд + фронтенд)
```

- **Доска** → http://localhost:5173
- **Админка** → http://localhost:5173/admin (пароль: `admin`)
- **Prisma Studio** → `npm run studio`

## Деплой на Render (бесплатно)

1. Загрузите код на GitHub
2. Зайдите на [render.com](https://render.com) → New → Web Service
3. Подключите GitHub-репозиторий
4. Render подхватит `render.yaml` автоматически
5. Нажмите Deploy

Или вручную:
- **Build command:** `npm run setup && npm run build`
- **Start command:** `npm run start`
- **Environment variables:** `ADMIN_PASSWORD=ваш_пароль`

## Структура

```
backend/    — Express + Prisma + SQLite
frontend/   — React + Vite + Tailwind (PWA)
```
