// Cálculo das linhas e dos totais para mostrar NO ECRÃ enquanto se vende.
// É a mesma lógica de Backend/services/calculos.js (em cêntimos, sem erros de vírgula).
// Quem manda é sempre o servidor: ao emitir, ele recalcula tudo com os preços da base de dados.

export const paraCentimos = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100)
export const deCentimos = (centimos) => centimos / 100

export function calcularLinha({ quantidade, precoCentimos, descontoCentimos = 0, ivaPercentagem, precosComIva }) {
  const bruto = quantidade * precoCentimos
  const desconto = Math.min(Math.max(descontoCentimos, 0), bruto)
  const taxa = Math.round(Number(ivaPercentagem) * 100)

  let base
  let iva
  let totalLinha
  if (precosComIva) {
    totalLinha = bruto - desconto
    base = Math.round((totalLinha * 10000) / (10000 + taxa))
    iva = totalLinha - base
  } else {
    base = bruto - desconto
    iva = Math.round((base * taxa) / 10000)
    totalLinha = base + iva
  }
  return { bruto, desconto, base, iva, totalLinha }
}

export function somarDocumento(linhas) {
  const soma = (campo) => linhas.reduce((s, l) => s + l[campo], 0)
  return { subtotal: soma('base'), descontoTotal: soma('desconto'), iva: soma('iva'), total: soma('totalLinha') }
}

// Agrupa o IVA por taxa (para o resumo do documento): [{ percentagem, base, iva }]
export function resumoPorTaxa(linhas) {
  const mapa = new Map()
  linhas.forEach((l) => {
    const atual = mapa.get(l.ivaPercentagem) || { percentagem: l.ivaPercentagem, base: 0, iva: 0 }
    atual.base += l.base
    atual.iva += l.iva
    mapa.set(l.ivaPercentagem, atual)
  })
  return [...mapa.values()].sort((a, b) => a.percentagem - b.percentagem)
}
