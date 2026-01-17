"use client"

import { PageHeader } from "@/components/layout/page-header"
import { DebtorsList } from "@/components/clients/debtors-list"

export default function DevedoresPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes Devedores"
        description="Visualize todos os clientes com pagamentos pendentes"
      />
      <DebtorsList />
    </div>
  )
}
