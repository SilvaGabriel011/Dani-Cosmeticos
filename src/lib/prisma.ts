import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL || ''
  const separator = url.includes('?') ? '&' : '?'
  const pooledUrl = url.includes('connection_limit')
    ? url
    : `${url}${separator}connection_limit=3&pool_timeout=15`

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: pooledUrl,
  })
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
