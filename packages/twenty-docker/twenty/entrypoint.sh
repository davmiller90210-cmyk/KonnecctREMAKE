#!/bin/sh
set -e

setup_and_migrate_db() {
    if [ "${DISABLE_DB_MIGRATIONS}" = "true" ]; then
        echo "Database setup and migrations are disabled, skipping..."
        return
    fi

    echo "Running database setup and migrations..."

    # Run setup and migration scripts.
    # Do not use "core schema exists" alone: an empty/partial DB can have schema "core"
    # but no tables, which skips init and breaks the app (e.g. core.keyValuePair missing).
    set +e
    has_kvp=$(psql -tAc "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'core' AND c.relname = 'keyValuePair' AND c.relkind = 'r')" ${PG_DATABASE_URL})
    psql_exit=$?
    set -e
    if [ "$psql_exit" -ne 0 ]; then
        echo "FATAL: psql could not reach PostgreSQL (exit ${psql_exit}). Check PG_DATABASE_URL, POSTGRES_PASSWORD, and that crm-db is healthy."
        exit 1
    fi
    if [ "$has_kvp" != "t" ]; then
        echo "Database is empty or incomplete (no core.keyValuePair). Running database:init:prod..."
        yarn database:init:prod
    fi

    yarn command:prod cache:flush
    if ! yarn command:prod upgrade; then
        echo "FATAL: yarn command:prod upgrade failed. The API will not start until migrations succeed."
        echo "Check DB connectivity, APP_VERSION, and migration logs above."
        exit 1
    fi
    yarn command:prod cache:flush

    echo "Successfully migrated DB!"
}

register_background_jobs() {
    if [ "${DISABLE_CRON_JOBS_REGISTRATION}" = "true" ]; then
        echo "Cron job registration is disabled, skipping..."
        return
    fi

    echo "Registering background sync jobs..."
    if yarn command:prod cron:register:all; then
        echo "Successfully registered all background sync jobs!"
    else
        echo "Warning: Failed to register background jobs, but continuing startup..."
    fi
}

setup_and_migrate_db
register_background_jobs

# Continue with the original Docker command
exec "$@"
