import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Create default settings
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      debitFeePercent: 1.5,
      creditFeePercent: 3.0,
      creditInstallmentFee: 4.0,
      defaultFeeAbsorber: "SELLER",
      lowStockAlertEnabled: true,
    },
  })

  console.log("✅ Settings created")

  // Create default categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: "Skincare" },
      update: {},
      create: { name: "Skincare" },
    }),
    prisma.category.upsert({
      where: { name: "Cremes" },
      update: {},
      create: { name: "Cremes" },
    }),
    prisma.category.upsert({
      where: { name: "Perfumaria" },
      update: {},
      create: { name: "Perfumaria" },
    }),
    prisma.category.upsert({
      where: { name: "Bijuteria" },
      update: {},
      create: { name: "Bijuteria" },
    }),
    prisma.category.upsert({
      where: { name: "Maquiagem" },
      update: {},
      create: { name: "Maquiagem" },
    }),
  ])

  console.log(`✅ ${categories.length} categories created`)

  // Create default brands
  const brands = await Promise.all([
    prisma.brand.upsert({
      where: { name: "Eudora" },
      update: {},
      create: { name: "Eudora" },
    }),
    prisma.brand.upsert({
      where: { name: "Natura" },
      update: {},
      create: { name: "Natura" },
    }),
    prisma.brand.upsert({
      where: { name: "Boticário" },
      update: {},
      create: { name: "Boticário" },
    }),
    prisma.brand.upsert({
      where: { name: "Romanel" },
      update: {},
      create: { name: "Romanel" },
    }),
    prisma.brand.upsert({
      where: { name: "Avon" },
      update: {},
      create: { name: "Avon" },
    }),
  ])

  console.log(`✅ ${brands.length} brands created`)

  console.log("\n🎉 Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
