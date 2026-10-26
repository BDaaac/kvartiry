# Rentiq — учёт аренды

Веб-приложение для учёта посуточной и помесячной аренды нескольких квартир:
шахматка-календарь, брони, платежи, расходы, дашборд с аналитикой, выгрузка в Excel
и подписка на календарь iPhone.

- **Сайт:** GitHub Pages (бесплатно)
- **База и вход:** Supabase (бесплатный тариф)
- Без ключей Supabase приложение работает в **демо-режиме** (данные только в браузере).

## Запуск у себя

```bash
npm install
npm run dev
```

Чтобы подключить базу, скопируйте `.env.example` в `.env` и заполните.

## Настройка (один раз)

### 1. Supabase
1. Зарегистрируйтесь на https://supabase.com и создайте проект (регион — Frankfurt или ближайший).
2. **SQL Editor → New query** → вставьте `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user → Create new user**: почта и пароль мамы
   (поставьте галочку *Auto Confirm User*).
4. **Authentication → Sign In / Providers → Email**: выключите *Allow new users to sign up*,
   чтобы никто посторонний не смог зарегистрироваться.
5. **Project Settings → API**: скопируйте `Project URL` и ключ `anon public`.

### 2. Календарь для iPhone (Edge Function)
1. **Edge Functions → Deploy a new function → Via Editor**. Имя функции должно совпадать с `CALENDAR_FUNCTION` в `src/lib/db.js` (сейчас `bright-task`).
2. Вставьте код из `supabase/functions/calendar/index.ts` → **Deploy**.
3. В настройках функции выключите **Verify JWT** (Enforce JWT verification) → Save.
4. В приложении: **Ещё → Календарь на iPhone → Получить ссылку → Подписаться**.

### 3. GitHub Pages
1. Создайте репозиторий на GitHub и загрузите туда этот проект (ветка `main`).
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL` — Project URL
   - `VITE_SUPABASE_ANON_KEY` — anon public key
3. **Settings → Pages → Source: GitHub Actions**.
4. После каждого `git push` сайт обновится сам: `https://<логин>.github.io/<репозиторий>/`.

### 4. На iPhone мамы
Откройте ссылку в Safari → кнопка «Поделиться» → **«На экран Домой»**.
Приложение появится с иконкой и будет открываться без адресной строки.

## Как считается аналитика
- **Получено** — платежи за период (без залогов; возвраты вычитаются).
- **Прибыль** = получено − расходы (общие расходы без квартиры тоже учитываются).
- **Загрузка** = занятые ночи / (дни периода × число квартир).
- **Средняя цена за ночь** — по посуточным броням, по ночам внутри периода.
- **Долг**: посуточно — сумма брони минус оплаты; помесячно — ставка × начавшиеся месяцы минус оплаты.

## Структура
```
src/lib/dates.js     даты
src/lib/calc.js      расчёты, аналитика, долги
src/lib/db.js        Supabase + демо-режим
src/lib/export.js    выгрузка в Excel
src/pages/           экраны
supabase/schema.sql  таблицы и права доступа
supabase/functions/calendar  календарь .ics для iPhone
```
