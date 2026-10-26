-- Код доступа в квартиру для каждой брони и сообщение гостю после оплаты.
-- Запустить один раз: Supabase → SQL Editor → New query → Run.
alter table bookings   add column if not exists access_code  text;
alter table properties add column if not exists paid_message text;
