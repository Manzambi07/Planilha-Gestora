// Executar com:  node --test tests/calculos.test.js
const test = require('node:test')
const assert = require('node:assert/strict')
const c = require('../services/calculos')

const linha = (extra) => c.calcularLinha({ quantidade: 1, precoCentimos: 10000, ivaPercentagem: 14, precosComIva: false, ...extra })

test('preço sem IVA: 100,00 Kz a 14% dá 114,00 Kz', () => {
  const l = linha()
  assert.deepEqual(l, { bruto: 10000, desconto: 0, base: 10000, iva: 1400, totalLinha: 11400 })
})

test('preço com IVA incluído: 114,00 Kz a 14% tem base 100,00 e IVA 14,00', () => {
  const l = linha({ precoCentimos: 11400, precosComIva: true })
  assert.equal(l.totalLinha, 11400)
  assert.equal(l.base, 10000)
  assert.equal(l.iva, 1400)
})

test('IVA incluído: base + IVA é sempre igual ao total da linha (arredondamentos)', () => {
  for (const preco of [1, 33, 99, 1999, 980000, 1850000, 123457]) {
    for (const qtd of [1, 2, 3, 7, 42]) {
      for (const taxa of [0, 5, 7, 14]) {
        const l = c.calcularLinha({ quantidade: qtd, precoCentimos: preco, ivaPercentagem: taxa, precosComIva: true })
        assert.equal(l.base + l.iva, l.totalLinha)
        assert.equal(l.totalLinha, qtd * preco)
      }
    }
  }
})

test('taxa 0% (isento): IVA é zero e o total é o preço', () => {
  const l = linha({ ivaPercentagem: 0 })
  assert.equal(l.iva, 0)
  assert.equal(l.totalLinha, 10000)
})

test('desconto reduz o total (preço sem IVA)', () => {
  const l = linha({ quantidade: 2, precoCentimos: 5000, descontoCentimos: 1000, ivaPercentagem: 0 })
  assert.equal(l.totalLinha, 9000)
})

test('desconto maior que a linha é recusado', () => {
  assert.throws(() => linha({ descontoCentimos: 10001 }), c.ErroNegocio)
})

test('quantidade tem de ser inteira e positiva', () => {
  assert.throws(() => linha({ quantidade: 0 }), c.ErroNegocio)
  assert.throws(() => linha({ quantidade: 1.5 }), c.ErroNegocio)
  assert.throws(() => linha({ quantidade: -2 }), c.ErroNegocio)
})

test('arredondamento do IVA: 3 x 0,33 Kz a 14%', () => {
  const l = c.calcularLinha({ quantidade: 3, precoCentimos: 33, ivaPercentagem: 14, precosComIva: false })
  assert.equal(l.base, 99)
  assert.equal(l.iva, 14) // 13,86 -> 14
  assert.equal(l.totalLinha, 113)
})

test('somarDocumento: total = subtotal + IVA e soma os descontos', () => {
  const linhas = [
    linha({ quantidade: 2, precoCentimos: 5000, descontoCentimos: 500 }),
    linha({ precoCentimos: 2500, ivaPercentagem: 7 }),
  ]
  const t = c.somarDocumento(linhas)
  assert.equal(t.total, t.subtotal + t.iva)
  assert.equal(t.descontoTotal, 500)
  assert.equal(t.total, linhas[0].totalLinha + linhas[1].totalLinha)
})

test('pagamento exato, sem troco', () => {
  const r = c.distribuirPagamentos(5000, [{ metodoId: 1, valorCentimos: 5000 }])
  assert.equal(r.troco, 0)
  assert.equal(r.pagamentos[0].valorCentimos, 5000)
})

test('pagamento a mais gera troco e fica registado só o valor devido', () => {
  const r = c.distribuirPagamentos(5000, [{ metodoId: 1, valorCentimos: 10000 }])
  assert.equal(r.troco, 5000)
  assert.equal(r.pagamentos[0].valorCentimos, 5000)
})

test('pagamento dividido (cartão + numerário) com troco no último', () => {
  const r = c.distribuirPagamentos(7000, [
    { metodoId: 2, valorCentimos: 3000 },
    { metodoId: 1, valorCentimos: 5000 },
  ])
  assert.equal(r.troco, 1000)
  assert.deepEqual(r.pagamentos.map((p) => p.valorCentimos), [3000, 4000])
})

test('pagamento insuficiente é recusado', () => {
  assert.throws(() => c.distribuirPagamentos(5000, [{ metodoId: 1, valorCentimos: 4999 }]), c.ErroNegocio)
  assert.throws(() => c.distribuirPagamentos(5000, []), c.ErroNegocio)
})

test('pagamentos a mais (troco maior que o último valor) são recusados', () => {
  assert.throws(
    () => c.distribuirPagamentos(1000, [{ metodoId: 1, valorCentimos: 5000 }, { metodoId: 2, valorCentimos: 500 }]),
    c.ErroNegocio,
  )
})

test('paraCentimos não sofre de erros de vírgula flutuante', () => {
  assert.equal(c.paraCentimos(19.99), 1999)
  assert.equal(c.paraCentimos(0.1 + 0.2), 30)
  assert.equal(c.paraCentimos('9800.00'), 980000)
  assert.equal(c.paraCentimos(1.005), 101)
})

test('numeração e ano no fuso de Angola', () => {
  assert.equal(c.formatarNumero('FR', 2026, 142), 'FR 2026/142')
  assert.equal(c.anoNoFuso(new Date('2026-12-31T23:30:00Z')), 2027)
  assert.equal(c.anoNoFuso(new Date('2026-06-15T10:00:00Z')), 2026)
})

test('hash: 64 caracteres, estável e sensível a qualquer alteração', () => {
  const base = { dataEmissao: new Date('2026-10-26T10:00:00Z'), numeroCompleto: 'FR 2026/1', totalCentimos: 11400, hashAnterior: '' }
  const h = c.calcularHash(base)
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.equal(c.calcularHash({ ...base }), h)
  assert.notEqual(c.calcularHash({ ...base, totalCentimos: 11401 }), h)
  assert.notEqual(c.calcularHash({ ...base, numeroCompleto: 'FR 2026/2' }), h)
  assert.notEqual(c.calcularHash({ ...base, hashAnterior: 'a'.repeat(64) }), h)
  assert.notEqual(c.calcularHash({ ...base, dataEmissao: new Date('2026-10-26T10:00:01Z') }), h)
})

test('hash ignora os milissegundos (o que a BD guarda)', () => {
  const a = c.calcularHash({ dataEmissao: new Date('2026-10-26T10:00:00.000Z'), numeroCompleto: 'X', totalCentimos: 1, hashAnterior: '' })
  const b = c.calcularHash({ dataEmissao: new Date('2026-10-26T10:00:00.789Z'), numeroCompleto: 'X', totalCentimos: 1, hashAnterior: '' })
  assert.equal(a, b)
})
