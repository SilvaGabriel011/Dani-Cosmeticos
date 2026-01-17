"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from "recharts"
import { Calendar, TrendingUp, TrendingDown, DollarSign, Activity, Clock } from "lucide-react"

interface DiaData {
  data: string
  diaSemana: string
  total: number
  vendas: number
  ticketMedio: number
  horaPico: string
  variacao: number
}

export function VendasPorDia() {
  const [dados, setDados] = useState<DiaData[]>([])
  const [mesSelecionado, setMesSelecionado] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDados() {
      try {
        const response = await fetch(`/api/relatorios/vendas-por-dia?mes=${mesSelecionado}`)
        const data = await response.json()
        setDados(data)
      } catch (error) {
        console.error("Erro ao buscar dados:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDados()
  }, [mesSelecionado])

  const meses = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    return date.toISOString().slice(0, 7)
  })

  const formatMes = (mes: string) => {
    const [ano, mesNum] = mes.split("-")
    const date = new Date(parseInt(ano), parseInt(mesNum) - 1)
    return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Vendas por Dia
          </CardTitle>
          <CardDescription>
            Análise detalhada de vendas diárias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[400px] w-full" />
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = dados.map(dia => ({
    name: new Date(dia.data).getDate(),
    vendas: dia.total,
    quantidade: dia.vendas,
  }))

  const chartDataVariacao = dados.map(dia => ({
    name: new Date(dia.data).getDate(),
    variacao: dia.variacao,
  }))

  const melhorDia = dados.reduce((max, dia) => dia.total > max.total ? dia : max, dados[0])
  const piorDia = dados.reduce((min, dia) => dia.total < min.total ? dia : min, dados[0])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Vendas por Dia</h3>
          <p className="text-sm text-muted-foreground">
            Análise detalhada das vendas diárias do mês
          </p>
        </div>
        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Selecione o mês" />
          </SelectTrigger>
          <SelectContent>
            {meses.map(mes => (
              <SelectItem key={mes} value={mes}>
                {formatMes(mes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total de Vendas Diárias</CardTitle>
            <CardDescription>
              Valor total vendido por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number | undefined) => 
                    value ? value.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }) : "R$ 0,00"
                  }
                  labelFormatter={(label) => `Dia ${label}`}
                />
                <Bar dataKey="vendas" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quantidade de Vendas</CardTitle>
            <CardDescription>
              Número de vendas realizadas por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number | undefined) => [value ? `${value} vendas` : "0 vendas", "Quantidade"]}
                  labelFormatter={(label) => `Dia ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="quantidade" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: "#8884d8" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variação Diária</CardTitle>
          <CardDescription>
            Percentual de variação dia a dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartDataVariacao}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value: number | undefined) => [value ? `${value.toFixed(1)}%` : "0%", "Variação"]}
                labelFormatter={(label) => `Dia ${label}`}
              />
              <Area 
                type="monotone" 
                dataKey="variacao" 
                stroke="#8884d8" 
                fill="#8884d8" 
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Dia</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {melhorDia?.total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }) || "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {melhorDia ? new Date(melhorDia.data).toLocaleDateString("pt-BR") : "-"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pior Dia</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {piorDia?.total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }) || "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {piorDia ? new Date(piorDia.data).toLocaleDateString("pt-BR") : "-"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Diária</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0 ? (dados.reduce((sum, d) => sum + d.total, 0) / dados.length).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Média de vendas por dia
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dias com Vendas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.filter(d => d.total > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              de {dados.length} dias no mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0 ? (dados.reduce((sum, d) => sum + d.ticketMedio, 0) / dados.length).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }) : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Média por venda
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hora de Pico</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.length > 0 ? dados[0].horaPico : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Horário com mais vendas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total do Mês</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.reduce((sum, d) => sum + d.total, 0).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Soma de todas as vendas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
