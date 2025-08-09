create extension if not exists vector;

alter table if exists page add column if not exists summary text;