# Mafia Game — Деплой та Поточний Стан

## 🚀 Як задеплоїти на Render (безкоштовно)

### Крок 1: Підготовка GitHub
1. Створіть репозиторій на GitHub
2. Виконайте `git init && git add . && git commit -m "initial" && git push`
3. `.env` не потрапить в гіт (додано до `.gitignore`)

### Крок 2: Деплой Backend на Render
1. Зайдіть на [render.com](https://render.com) → New → **Web Service**
2. Підключіть GitHub репозиторій
3. Налаштування:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm run start:prod`
4. **Environment Variables** (вкладка Environment):
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_jR6hPsXwA3HS@ep-tiny-lake-alud8qdb-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   JWT_SECRET=mylittleboyMANxxx
   CORS_ORIGIN=https://ваш-фронтенд.onrender.com
   USE_MOCK_REDIS=false
   REDIS_URL=redis://ваш-redis-url:6379
   PORT=3000
   ```
5. Натисніть Deploy!
6. Після деплою, `RENDER_EXTERNAL_URL` встановиться автоматично — keep-alive пінг працюватиме

### Крок 3: Деплой Frontend на Render
1. New → **Static Site**
2. Підключіть той же репозиторій
3. Налаштування:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. **Environment Variables:**
   ```
   VITE_API_URL=https://ваш-бекенд.onrender.com
   ```
5. Натисніть Deploy!
6. Після деплою, поверніться до Backend → Environment → оновіть `CORS_ORIGIN` на URL фронтенду

### Крок 4: Redis (обов'язково для продакшену)
**Варіанти безкоштовного Redis:**

1. **Upstash** (рекомендовано, free tier):
   - Зайдіть на [upstash.com](https://upstash.com)
   - Create Database → виберіть регіон EU
   - Скопіюйте URL у форматі `rediss://default:password@host:port`
   - Вставте в `REDIS_URL` на Render


**Без Redis:** Якщо `USE_MOCK_REDIS=true` — ігри зберігаються в пам'яті. При перезапуску сервера всі активні ігри зникнуть. Для тестування ОК, для продакшену — ні.

### Крок 5: Перші кроки після деплою
1. Зареєструвати першого юзера на сайті
2. Зайти в базу (Neon Console) і виконати SQL з `prisma/seed-roles.sql` для ролей адміністрації
3. Потім `node prisma/promote.js ВашНікнейм` для призначення себе Власником

---

## ✅ Що було зроблено для продакшену

| # | Зміна | Файл(и) |
|---|-------|---------|
| 1 | JWT секрет оновлено | `backend/.env` |
| 2 | Створено `.env.example` (шаблон без секретів) | `backend/.env.example` |
| 3 | Додано `.gitignore` для бекенду (`.env`, `node_modules`, `dist`, `*.db`) | `backend/.gitignore` |
| 4 | Встановлено **Helmet** (HTTP security headers) | `backend/src/main.ts` |
| 5 | Додано **Render keep-alive** self-ping кожні 14 хв | `backend/src/main.ts` |
| 6 | Встановлено **Rate Limiting** (60 запитів/хв на IP) | `backend/src/app.module.ts` |
| 7 | WebSocket Gateway позначено `@SkipThrottle()` | `backend/src/game/game.gateway.ts` |
| 8 | WebSocket CORS тепер читає `CORS_ORIGIN` з env | `backend/src/game/game.gateway.ts` |
| 9 | Додано **валідацію аватара** (блок SVG, перевірка URL, ліміт) | `backend/src/users/users.controller.ts` |
| 10 | Створено `frontend/.env.production` для `VITE_API_URL` | `frontend/.env.production` |
| 11 | Видалено зайві файли: `vite.svg`, `fix.js`, `prisma/dev.db` | — |
| 12 | Виправлено іконку валюти 🪙 → SVG CoinIcon | `frontend/src/components/CoinIcon.tsx` |

---

## 🔧 ENV змінні — повний список

### Backend (`backend/.env`)
| Змінна | Опис | Приклад |
|--------|------|---------|
| `DATABASE_URL` | PostgreSQL URL (Neon) | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Секрет для JWT токенів | `mylittleboyMANxxx` |
| `CORS_ORIGIN` | URL фронтенду | `https://mafia.onrender.com` |
| `USE_MOCK_REDIS` | `true` для локалки, `false` для прод | `false` |
| `REDIS_URL` | URL Redis сервера | `redis://default:pass@host:port` |
| `PORT` | Порт сервера | `3000` |
| `RENDER_EXTERNAL_URL` | Встановлюється Render автоматично | — |

### Frontend (`frontend/.env.production`)
| Змінна | Опис | Приклад |
|--------|------|---------|
| `VITE_API_URL` | URL бекенду | `https://mafia-backend.onrender.com` |

---

## ⚠️ Важливо знати

- **Render Free Tier** — сервер "засинає" через 15 хв без запитів. Вбудований keep-alive пінг тримає його живим.
- **Перший запуск** після сну може зайняти ~30 секунд
- **Redis Mock** — ок для тестів, але при restart сервера ігри зникають
- **Сторінка "Колекція"** — поки заглушка ("Coming soon"), не заважає роботі
