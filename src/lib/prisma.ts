import { PrismaClient } from "@prisma/client";

// Prisma Postgres provides a direct URL for Prisma CLI operations and a pooled
// URL for application traffic. Prefer the pooled URL inside Vercel Functions.
const runtimeDatabaseUrl =
  process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(
    runtimeDatabaseUrl
      ? { datasources: { db: { url: runtimeDatabaseUrl } } }
      : {}
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
