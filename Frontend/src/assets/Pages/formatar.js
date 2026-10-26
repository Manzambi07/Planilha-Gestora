const numero = new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 3 })
const dinheiro = new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const n = (v) => numero.format(Number(v) || 0)
export const kz = (v) => `${dinheiro.format(Number(v) || 0)} Kz`

// valores grandes em formato curto para os KPIs: 1 250 000 -> 1,25 M Kz
export function kzCurto(v) {
  const x = Number(v) || 0
  const abs = Math.abs(x)
  if (abs >= 1e9) return `${(x / 1e9).toLocaleString('pt-AO', { maximumFractionDigits: 2 })} mM Kz`
  if (abs >= 1e6) return `${(x / 1e6).toLocaleString('pt-AO', { maximumFractionDigits: 2 })} M Kz`
  return kz(x)
}

export const dataHora = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// "2026-10-25" -> "25/10"
export const diaCurto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export const PERFIS = {
  admin: 'Administrador',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
}
