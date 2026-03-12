import { HealthCheckPanel } from '@/components/sales/health-check-panel'

export default function HealthCheckPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Verificação de Saúde</h1>
        <p className="text-muted-foreground">Varredura automática de inconsistências nas vendas</p>
      </div>
      <HealthCheckPanel />
    </div>
  )
}
