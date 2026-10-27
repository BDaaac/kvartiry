-- Депозит можно удержать (за ущерб, штраф): новый тип платежа deposit_keep.
-- Запустить один раз: Supabase → SQL Editor → New query → Run.
alter table payments drop constraint if exists payments_kind_check;
alter table payments add constraint payments_kind_check
  check (kind in ('payment','deposit','deposit_return','deposit_keep','refund'));
