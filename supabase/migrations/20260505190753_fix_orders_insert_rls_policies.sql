/*
  # Fix orders INSERT RLS policies

  Replaces all existing INSERT policies on the orders table with two correct ones:
  - Authenticated users: must set user_id = their own auth.uid()
  - Anonymous/guest users: user_id must be null, customer_email must be present
*/

alter table orders enable row level security;

drop policy if exists "Anyone can insert orders" on orders;
drop policy if exists "Authenticated users can insert own orders" on orders;
drop policy if exists "Anon users can insert orders with email" on orders;
drop policy if exists "Users can insert orders" on orders;
drop policy if exists "Guests can insert orders" on orders;

create policy "Users can insert orders"
  on orders
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
  );

create policy "Guests can insert orders"
  on orders
  for insert
  to anon
  with check (
    user_id is null
    and customer_email is not null
  );
