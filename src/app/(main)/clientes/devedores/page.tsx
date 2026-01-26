'use client'

import { DebtorsList } from '@/components/clients/debtors-list'
import { PageHeader } from '@/components/layout/page-header'

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
