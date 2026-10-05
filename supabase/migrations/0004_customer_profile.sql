-- Nome e foto de perfil do cliente. Nullable porque store_owner/platform_admin
-- não preenchem esses campos (só pessoas físicas no papel de cliente usam).
alter table users
  add column primeiro_nome text,
  add column sobrenome text,
  add column url_foto_de_perfil text;
