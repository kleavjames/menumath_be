export function isLocalPostgresUrl(connectionString: string): boolean {
  try {
    const hostname = new URL(connectionString).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Runtime connection (Nest / PrismaClient). Use pooled Neon URL in production. */
export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

/**
 * Prisma Migrate connection. Neon needs a direct (unpooled) URL; local Docker
 * uses the same URL as the app.
 */
export function resolveMigrationDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (databaseUrl && isLocalPostgresUrl(databaseUrl)) {
    return databaseUrl;
  }

  const unpooled = process.env.DATABASE_URL_UNPOOLED;
  if (unpooled) {
    return unpooled;
  }

  if (databaseUrl) {
    return databaseUrl;
  }

  throw new Error(
    'Set DATABASE_URL (and DATABASE_URL_UNPOOLED for Neon migrations in production)',
  );
}
