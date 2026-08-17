#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[FiberOps] Waiting for the MySQL database..."
  node --input-type=module -e '
    import mysql from "mysql2/promise";
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required when RUN_MIGRATIONS=true");
    let lastError;
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      try {
        const connection = await mysql.createConnection(url);
        await connection.ping();
        await connection.end();
        process.exit(0);
      } catch (error) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    throw lastError;
  '
  echo "[FiberOps] Applying database migrations..."
  corepack pnpm drizzle-kit migrate
fi

exec "$@"
