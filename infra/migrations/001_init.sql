-- 001_init.sql
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists app_user (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz default now()
);

create table if not exists page (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app_user(id) on delete set null,
  title text not null,
  content text not null,
  view_type text not null default 'table',
  embedding vector(1536),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists tag (
  id serial primary key,
  name text unique not null
);

create table if not exists page_tag (
  page_id uuid references page(id) on delete cascade,
  tag_id int references tag(id) on delete cascade,
  primary key (page_id, tag_id)
);

create table if not exists task (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references page(id) on delete cascade,
  title text not null,
  status text not null default 'todo',
  position int not null default 0
);
