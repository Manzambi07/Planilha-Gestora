// Cópias de segurança: base de dados PostgreSQL (pg_dump) + pasta uploads, num único .zip.
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const RAIZ = path.join(__dirname, '..')
const UPLOADS = path.join(RAIZ, 'uploads')
// só estes nomes são aceites: impede pedidos do género "../../.env"
const PADRAO = /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(_auto)?\.zip$/

const pasta = () => process.env.BACKUP_PASTA || path.join(RAIZ, 'backups')
const manter = () => {
  const n = parseInt(process.env.BACKUP_MANTER, 10)
  return n > 0 ? n : 14
}
const automaticoLigado = () => process.env.BACKUP_AUTOMATICO === 'true'
const horaAutomatica = () => {
  const h = parseInt(process.env.BACKUP_HORA, 10)
  return h >= 0 && h <= 23 ? h : 2
}

let emCurso = false

const nomeValido = (nome) => typeof nome === 'string' && PADRAO.test(nome)
const caminhoBackup = (nome) => (nomeValido(nome) ? path.join(pasta(), nome) : null)

const p2 = (n) => String(n).padStart(2, '0')
const carimbo = (d = new Date()) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`

const LEIA_ME = `COPIA DE SEGURANCA - PLANILHA GESTORA

Conteudo:
  base_de_dados.sql   toda a base de dados (PostgreSQL)
  uploads/            fotografias dos produtos, logotipo e QR Codes

COMO RESTAURAR
 1. Pare o servidor (Backend).
 2. Restaure a base de dados com o psql (ou no pgAdmin, Query Tool > abrir ficheiro):
      psql -U UTILIZADOR -d NOME_DA_BASE -f base_de_dados.sql
    O ficheiro apaga e recria as tabelas, por isso so o faca quando quiser
    voltar ao estado desta copia.
 3. Copie a pasta "uploads" deste ficheiro para dentro da pasta Backend,
    substituindo a existente.
 4. Arranque o servidor e confirme que consegue iniciar sessao.

O ficheiro .env nao vem nesta copia (tem palavras-passe): guarde-o a parte, num local seguro.
`

// ------------------------------------------------------------------ pg_dump
function localizarPgDump() {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL'
    try {
      const versoes = fs.readdirSync(base).filter((v) => /^\d+/.test(v)).sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
      for (const v of versoes) {
        const candidato = path.join(base, v, 'bin', 'pg_dump.exe')
        if (fs.existsSync(candidato)) return candidato
      }
    } catch { /* pasta inexistente: usa o PATH */ }
  }
  return 'pg_dump'
}

function executar(ficheiro, args, opcoes = {}) {
  return new Promise((resolve, reject) => {
    execFile(ficheiro, args, { windowsHide: true, maxBuffer: 20 * 1024 * 1024, ...opcoes }, (erro, stdout, stderr) => {
      if (erro) { erro.stderr = stderr; reject(erro); return }
      resolve({ stdout, stderr })
    })
  })
}

async function verificarPgDump() {
  const caminho = localizarPgDump()
  try {
    const { stdout } = await executar(caminho, ['--version'])
    return { disponivel: true, versao: stdout.trim(), caminho }
  } catch {
    return { disponivel: false, versao: null, caminho }
  }
}

function compactar(sql, destino) {
  const archiver = require('archiver') // npm install archiver
  return new Promise((resolve, reject) => {
    const saida = fs.createWriteStream(destino)
    const arquivo = archiver('zip', { zlib: { level: 6 } })
    saida.on('close', resolve)
    saida.on('error', reject)
    arquivo.on('error', reject)
    arquivo.pipe(saida)
    arquivo.file(sql, { name: 'base_de_dados.sql' })
    if (fs.existsSync(UPLOADS)) arquivo.directory(UPLOADS, 'uploads')
    arquivo.append(LEIA_ME, { name: 'LEIA-ME.txt' })
    arquivo.finalize()
  })
}

// ------------------------------------------------------------------ operações
function listarBackups() {
  const dir = pasta()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(nomeValido)
    .map((nome) => {
      const st = fs.statSync(path.join(dir, nome))
      return { nome, tamanho: st.size, criadoEm: st.mtime.toISOString(), automatico: nome.endsWith('_auto.zip') }
    })
    .sort((a, b) => b.nome.localeCompare(a.nome))
}

function apagarBackup(nome) {
  const caminho = caminhoBackup(nome)
  if (!caminho || !fs.existsSync(caminho)) return false
  fs.rmSync(caminho)
  return true
}

// guarda só as últimas N cópias automáticas (as manuais nunca são apagadas sozinhas)
function limparAutomaticosAntigos() {
  const autos = listarBackups().filter((b) => b.automatico)
  autos.slice(manter()).forEach((b) => apagarBackup(b.nome))
}

async function criarBackup({ automatico = false } = {}) {
  if (emCurso) throw new Error('Já existe uma cópia de segurança em curso. Aguarde um momento.')
  emCurso = true

  const dir = pasta()
  fs.mkdirSync(dir, { recursive: true })
  const nome = `backup_${carimbo()}${automatico ? '_auto' : ''}.zip`
  const zip = path.join(dir, nome)
  const sql = path.join(dir, `.tmp_${Date.now()}.sql`)

  try {
    try {
      await executar(localizarPgDump(), [
        '-h', process.env.DB_HOST || 'localhost',
        '-p', String(process.env.DB_PORT || 5432),
        '-U', process.env.DB_USER,
        '-d', process.env.DB_NAME,
        '--no-owner', '--no-privileges', '--clean', '--if-exists', '--no-password',
        '-f', sql,
      ], { env: { ...process.env, PGPASSWORD: process.env.DB_PASS || '' } })
    } catch (erro) {
      if (erro.code === 'ENOENT') {
        throw new Error('Não foi encontrado o programa pg_dump. Instale as ferramentas do PostgreSQL ou indique o caminho em PG_DUMP_PATH no ficheiro .env.')
      }
      const detalhe = String(erro.stderr || erro.message).trim().split('\n').slice(-2).join(' ')
      throw new Error(`Falha ao copiar a base de dados: ${detalhe}`)
    }

    try {
      await compactar(sql, zip)
    } catch (erro) {
      if (erro.code === 'MODULE_NOT_FOUND') throw new Error('Falta instalar o módulo "archiver": execute npm install archiver na pasta Backend.')
      throw new Error(`Falha ao criar o ficheiro da cópia: ${erro.message}`)
    }

    const st = fs.statSync(zip)
    if (automatico) limparAutomaticosAntigos()
    return { nome, tamanho: st.size, criadoEm: st.mtime.toISOString(), automatico }
  } catch (erro) {
    fs.rmSync(zip, { force: true })
    throw erro
  } finally {
    fs.rmSync(sql, { force: true })
    emCurso = false
  }
}

// cópia automática diária (BACKUP_AUTOMATICO=true no .env). Corre à hora de BACKUP_HORA (predefinição 02h).
function agendarAutomatico() {
  if (!automaticoLigado()) return false
  const marcar = () => {
    const agora = new Date()
    const proxima = new Date(agora)
    proxima.setHours(horaAutomatica(), 0, 0, 0)
    if (proxima <= agora) proxima.setDate(proxima.getDate() + 1)
    setTimeout(async () => {
      try {
        const b = await criarBackup({ automatico: true })
        console.log('cópia de segurança automática criada:', b.nome)
      } catch (erro) {
        console.error('falha na cópia de segurança automática:', erro.message)
      }
      marcar()
    }, proxima - agora)
  }
  marcar()
  return true
}

module.exports = {
  nomeValido, caminhoBackup, listarBackups, apagarBackup, criarBackup, limparAutomaticosAntigos,
  verificarPgDump, agendarAutomatico, automaticoLigado, horaAutomatica, manter,
}
