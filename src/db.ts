import { PrismaClient } from '@prisma/client'

/**
 * Database client instance using Prisma ORM
 * Provides type-safe access to the database
 */
export const db = new PrismaClient()