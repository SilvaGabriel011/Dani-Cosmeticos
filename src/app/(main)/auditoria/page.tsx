'use client'

import { PageHeader } from '@/components/layout/page-header'
import { AuditDashboard } from '@/components/sales/audit-dashboard'

export default function AuditoriaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditoria"
        description="Verificação de integridade e diagnóstico de vendas"
      />
      <AuditDashboard />
    </div>
  )
}
