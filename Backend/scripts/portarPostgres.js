// Converte os ficheiros que ainda têm características do MySQL para o PostgreSQL.
// Executar dentro da pasta Backend:   node scripts/portarPostgres.js
// Pode correr mais de uma vez sem problema. Antes de mexer, guarda cópia em _backup_antes_postgres/.
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const BACKUP = path.join(RAIZ, '_backup_antes_postgres')

// [procurar, substituir]
const MODELOS = [
  [/DataTypes\.TINYINT\.UNSIGNED/g, 'DataTypes.SMALLINT'],
  [/DataTypes\.TINYINT/g, 'DataTypes.SMALLINT'],
  [/DataTypes\.SMALLINT\.UNSIGNED/g, 'DataTypes.SMALLINT'],
  [/DataTypes\.INTEGER\.UNSIGNED/g, 'DataTypes.INTEGER'],
  [/DataTypes\.BIGINT\.UNSIGNED/g, 'DataTypes.BIGINT'],
]
const PESQUISAS = [[/Op\.like\b/g, 'Op.iLike']] // no PostgreSQL o LIKE distingue maiúsculas; o ILIKE não

const alvos = [
  ['models', MODELOS],
  ['routes', PESQUISAS],
  ['services', PESQUISAS],
  ['utils', PESQUISAS],
]

let alterados = 0
for (const [pasta, regras] of alvos) {
  const dir = path.join(RAIZ, pasta)
  if (!fs.existsSync(dir)) continue
  for (const nome of fs.readdirSync(dir)) {
    if (!nome.endsWith('.js')) continue
    const ficheiro = path.join(dir, nome)
    const antes = fs.readFileSync(ficheiro, 'utf8')
    let depois = antes
    for (const [de, para] of regras) depois = depois.replace(de, para)
    if (depois === antes) continue

    fs.mkdirSync(path.join(BACKUP, pasta), { recursive: true })
    fs.writeFileSync(path.join(BACKUP, pasta, nome), antes)
    fs.writeFileSync(ficheiro, depois)
    alterados += 1
    console.log('alterado:', `${pasta}/${nome}`)
  }
}

console.log(alterados ? `\n${alterados} ficheiro(s) alterados. Cópias originais em _backup_antes_postgres/` : 'Nada para alterar: já está tudo convertido.')

// avisos do que fica por rever à mão
const suspeitos = []
for (const pasta of ['routes', 'services', 'utils']) {
  const dir = path.join(RAIZ, pasta)
  if (!fs.existsSync(dir)) continue
  for (const nome of fs.readdirSync(dir)) {
    if (!nome.endsWith('.js')) continue
    const texto = fs.readFileSync(path.join(dir, nome), 'utf8')
    if (/DATE_FORMAT|IFNULL\(|ativo\s*=\s*1\b|GROUP_CONCAT|`[a-z_]+`\s*=|LIMIT\s+\d+\s*,\s*\d+|STR_TO_DATE/.test(texto)) suspeitos.push(`${pasta}/${nome}`)
  }
}
if (suspeitos.length) console.log('\nATENÇÃO: ainda têm SQL escrito à mão do MySQL (rever):', suspeitos.join(', '))
