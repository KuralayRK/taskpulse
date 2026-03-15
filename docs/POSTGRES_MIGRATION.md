# Переход на PostgreSQL (без потери данных)

## 1. Скачать бэкап с текущего сайта

Пока сайт ещё на SQLite (https://taskpulse-1nqc.onrender.com):

- Открой: `https://taskpulse-1nqc.onrender.com/api/admin/export`
- Введи пароль админа (заголовок `x-admin-key` или логин, если настроен).
- Сохрани файл `taskpulse-backup.json` — в нём все люди, направления, задачи, назначения, комментарии.

Через curl (подставь свой пароль):

```bash
curl -H "x-admin-key: ВАШ_ПАРОЛЬ" "https://taskpulse-1nqc.onrender.com/api/admin/export" -o taskpulse-backup.json
```

## 2. Создать PostgreSQL в Render

- В панели Render: **Dashboard → New → PostgreSQL**.
- Создай базу, скопируй **Internal Database URL** (или External, если приложение в другом проекте).
- В сервисе **taskpulse** (Web Service) открой **Environment** и добавь переменную:
  - **Key:** `DATABASE_URL`
  - **Value:** вставь URL вида `postgresql://user:pass@host/db?sslmode=require`

## 3. Задеплоить приложение с Postgres

- Закоммить и запушь изменения в GitHub (схема на Postgres, миграции, новый build).
- Render соберёт проект: выполнит `prisma migrate deploy` (таблицы создадутся в Postgres). Никакой `db push` и seed на проде не запускаются — текущие данные в новой БД пока пустые.

## 4. Импортировать бэкап в новую БД

После успешного деплоя загрузи сохранённый JSON в новую БД:

```bash
curl -X POST -H "x-admin-key: ВАШ_ПАРОЛЬ" -H "Content-Type: application/json" \
  -d @taskpulse-backup.json \
  "https://taskpulse-1nqc.onrender.com/api/admin/import"
```

(Или используй Postman/Insomnia: POST на `/api/admin/import`, тело — содержимое `taskpulse-backup.json`.)

Ответ `{ "ok": true, "people": ..., "directions": ..., "tasks": ... }` — данные перенесены.

## 5. Дальнейшие обновления

- При следующих пушах в GitHub Render снова запускает только `prisma migrate deploy` (новые миграции, если появятся) и сборку.
- Seed и `db push` на проде не выполняются — данные не стираются.

---

**Локальная разработка:** по-прежнему можно использовать SQLite: в `.env` в папке `backend` задай `DATABASE_URL=file:./dev.db` и работай с `npm run setup:backend` (db push + seed). Для локального Postgres задай `DATABASE_URL=postgresql://...` и используй `npx prisma migrate deploy` или `migrate dev`.
