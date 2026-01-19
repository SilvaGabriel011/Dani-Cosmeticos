"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, User, DollarSign } from "lucide-react"

interface Cliente {
  id: string
  nome: string
  totalCompras: number
  totalPago: number
  totalEmAberto: number
  quantidadeVendas: number
  ticketMedio: number
  ultimaCompra: string
}

export function TopClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTopClientes() {
      try {
        const response = await fetch("/api/relatorios/top-clientes")
        const data = await response.json()
        setClientes(data)
      } catch (error) {
        console.error("Erro ao buscar top clientes:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTopClientes()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Top Clientes
          </CardTitle>
          <CardDescription>
            Clientes com maior volume de compras
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Top 10 Clientes
          </CardTitle>
          <CardDescription>
            Clientes com maior volume de compras nos últimos 12 meses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total Compras</TableHead>
                <TableHead className="text-green-600">Pago</TableHead>
                <TableHead className="text-amber-600">Em Aberto</TableHead>
                <TableHead>Nº Vendas</TableHead>
                <TableHead>Última Compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((cliente, index) => (
                <TableRow key={cliente.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {index < 3 && (
                        <Badge variant={index === 0 ? "default" : index === 1 ? "secondary" : "outline"}>
                          {index + 1}º
                        </Badge>
                      )}
                      {index >= 3 && (
                        <span className="text-muted-foreground">{index + 1}º</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {cliente.nome}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">
                      {cliente.totalCompras.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="text-green-600 font-medium">
                    {cliente.totalPago.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell className="text-amber-600 font-medium">
                    {cliente.totalEmAberto.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </TableCell>
                  <TableCell>{cliente.quantidadeVendas}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {cliente.ultimaCompra ? new Date(cliente.ultimaCompra).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliente #1</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clientes[0]?.nome || "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {clientes[0]?.totalCompras.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              }) || "-"} em compras
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio Top</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clientes.length > 0
                ? Math.max(...clientes.map(c => c.ticketMedio)).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              Maior ticket médio entre os top clientes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Top 10</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clientes
                .reduce((sum, c) => sum + c.totalCompras, 0)
                .toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
            </div>
            <p className="text-xs text-muted-foreground">
              Soma das compras dos top 10 clientes
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
