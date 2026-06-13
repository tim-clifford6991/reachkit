alter table scans add column ip_hash text;
alter table scans add column created_at timestamptz not null default now();
create index if not exists scans_ip_hash_created_idx on scans (ip_hash, created_at);
create index if not exists apps_store_url_idx on apps (store_url);
