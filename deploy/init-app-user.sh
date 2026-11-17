#!/bin/sh
set -eu
# Executado apenas na criação de um volume novo. Nunca registra as senhas.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE kaminsky LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE kaminsky TO kaminsky;
GRANT USAGE, CREATE ON SCHEMA public TO kaminsky;
SQL
