-- Схема базы rent.kz.
-- Запустить один раз: Supabase → SQL Editor → New query → вставить весь файл → Run.

create extension if not exists btree_gist;

-- Квартиры
create table if not exists properties (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  address       text,
  color         text not null default '#a8662e',
  rate_daily    numeric(12,0),          -- базовая цена за сутки, ₸
  rate_monthly  numeric(12,0),          -- базовая цена за месяц, ₸
  notes         text,                   -- код домофона, wifi и т.п.
  welcome_message text,                 -- сообщение гостю после бронирования (WhatsApp)
  paid_message  text,                   -- сообщение после оплаты, с кодом доступа
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Брони (посуточно и помесячно)
create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  property_id   uuid not null references properties on delete cascade,
  mode          text not null default 'daily' check (mode in ('daily','monthly')),
  check_in      date not null,
  check_out     date,                   -- для помесячной может быть пусто = бессрочно
  guest_name    text,
  guest_phone   text,
  guests_count  int,
  price_total   numeric(12,0),          -- посуточно: сумма за всё проживание
  monthly_rate  numeric(12,0),          -- помесячно: сумма в месяц
  deposit       numeric(12,0) not null default 0, -- депозит гостя (не доход, возвращается)
  source        text not null default 'krisha',
  status        text not null default 'confirmed' check (status in ('pending','confirmed','cancelled')),
  access_code   text,                   -- код доступа в квартиру для этого гостя
  notes         text,
  created_at    timestamptz not null default now(),
  constraint dates_ok check (check_out is null or check_out > check_in),
  constraint daily_has_checkout check (mode = 'monthly' or check_out is not null),
  -- нельзя забронировать одну квартиру дважды на одни даты
  constraint no_overlap exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status <> 'cancelled')
);

-- Платежи от гостей
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  booking_id  uuid not null references bookings on delete cascade,
  amount      numeric(12,0) not null,
  paid_at     date not null default current_date,
  method      text not null default 'kaspi' check (method in ('kaspi','cash','transfer','other')),
  kind        text not null default 'payment' check (kind in ('payment','deposit','deposit_return','deposit_keep','refund')),
  note        text,
  created_at  timestamptz not null default now()
);

-- Расходы
create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  property_id  uuid references properties on delete set null, -- пусто = общий расход
  category     text not null,
  amount       numeric(12,0) not null,
  spent_at     date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);

-- Секретная ссылка на календарь для iPhone
create table if not exists calendar_tokens (
  user_id  uuid primary key default auth.uid() references auth.users on delete cascade,
  token    text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);

create index if not exists bookings_property_idx on bookings (property_id, check_in);
create index if not exists payments_booking_idx on payments (booking_id);
create index if not exists expenses_date_idx on expenses (spent_at);

-- Доступ: каждый видит только свои данные
alter table properties      enable row level security;
alter table bookings        enable row level security;
alter table payments        enable row level security;
alter table expenses        enable row level security;
alter table calendar_tokens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['properties','bookings','payments','expenses','calendar_tokens'] loop
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
