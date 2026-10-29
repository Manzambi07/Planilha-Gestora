// node --test tests/backup.test.js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'))
process.env.BACKUP_PASTA = dir
process.env.BACKUP_MANTER = '2'
const b = require('../services/backup')

const criar = (nome) => fs.writeFileSync(path.join(dir, nome), 'x')

test('só aceita nomes de cópias geradas pelo sistema', () => {
  assert.equal(b.nomeValido('backup_2026-10-27_02-00-00.zip'), true)
  assert.equal(b.nomeValido('backup_2026-10-27_02-00-00_auto.zip'), true)
  for (const mau of ['../.env', '..\\.env', 'backup_x.zip', 'backup_2026-10-27_02-00-00.zip/../../x', '/etc/passwd', '', null, undefined, 42]) {
    assert.equal(b.nomeValido(mau), false, String(mau))
    assert.equal(b.caminhoBackup(mau), null, String(mau))
  }
})

test('o caminho fica sempre dentro da pasta de cópias', () => {
  const c = b.caminhoBackup('backup_2026-10-27_02-00-00.zip')
  assert.equal(path.dirname(c), dir)
})

test('lista só as cópias válidas, da mais recente para a mais antiga', () => {
  criar('backup_2026-10-25_02-00-00_auto.zip')
  criar('backup_2026-10-27_10-00-00.zip')
  criar('backup_2026-10-26_02-00-00_auto.zip')
  criar('outro_ficheiro.zip')
  criar('.tmp_123.sql')
  const nomes = b.listarBackups().map((x) => x.nome)
  assert.deepEqual(nomes, ['backup_2026-10-27_10-00-00.zip', 'backup_2026-10-26_02-00-00_auto.zip', 'backup_2026-10-25_02-00-00_auto.zip'])
  assert.equal(b.listarBackups()[1].automatico, true)
  assert.equal(b.listarBackups()[0].automatico, false)
})

test('guarda só as últimas N automáticas e nunca apaga as manuais', () => {
  criar('backup_2026-10-24_02-00-00_auto.zip') // a 3.ª automática: com BACKUP_MANTER=2 tem de sair
  b.limparAutomaticosAntigos()
  const nomes = b.listarBackups().map((x) => x.nome)
  assert.deepEqual(nomes, ['backup_2026-10-27_10-00-00.zip', 'backup_2026-10-26_02-00-00_auto.zip', 'backup_2026-10-25_02-00-00_auto.zip'])
})

test('apagar só funciona com nomes válidos que existem', () => {
  assert.equal(b.apagarBackup('../x'), false)
  assert.equal(b.apagarBackup('backup_2000-01-01_00-00-00.zip'), false)
  assert.equal(b.apagarBackup('backup_2026-10-27_10-00-00.zip'), true)
  assert.equal(b.listarBackups().length, 2)
})

test('sem pg_dump instalado, a verificação diz que não está disponível', async () => {
  process.env.PG_DUMP_PATH = '/caminho/que/nao/existe/pg_dump'
  const r = await b.verificarPgDump()
  assert.equal(r.disponivel, false)
})

test('criar cópia sem pg_dump dá uma mensagem em português e não deixa lixo', async () => {
  process.env.PG_DUMP_PATH = '/caminho/que/nao/existe/pg_dump'
  await assert.rejects(() => b.criarBackup(), /pg_dump/)
  const restos = fs.readdirSync(dir).filter((f) => f.startsWith('.tmp_') && f.endsWith('.sql'))
  assert.deepEqual(restos, ['.tmp_123.sql']) // só o ficheiro que o próprio teste criou
})
