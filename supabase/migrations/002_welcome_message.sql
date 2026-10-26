-- Шаблон приветственного сообщения гостю (WhatsApp) для каждой квартиры.
-- Запустить один раз: Supabase → SQL Editor → New query → Run.
alter table properties add column if not exists welcome_message text;
