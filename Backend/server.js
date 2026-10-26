require('dotenv').config()
const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

// tem de vir depois do dotenv: falha logo ao arrancar se faltar o JWT_SECRET
const { exigirLogin, exigirPerfil, escritaPara } = require('./middleware/auth')

const App = express()
const PORT = process.env.PORT || 7449

// o frontend (Vite) corre noutra origem; as imagens de /uploads também são lidas por ele
App.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
App.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim()),
}))
App.use(express.json({ limit: '1mb' }))

// fotos dos produtos, logotipo e imagens dos QR Codes
App.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ---- público
App.use('/api/auth', require('./routes/auth.routes'))

// ---- ver: qualquer utilizador com sessão | inserir, editar, eliminar: admin e gestor
const gestao = [exigirLogin, escritaPara('admin', 'gestor')]
App.use('/api/produtos', ...gestao, require('./routes/produtos.routes'))
App.use('/api/categorias', ...gestao, require('./routes/categorias.routes'))
App.use('/api/fornecedores', ...gestao, require('./routes/fornecedores.routes'))

// ---- faturação: vender, emitir e consultar documentos (todos os perfis; anular e verificar são restritos dentro do ficheiro)
App.use('/api/faturacao', exigirLogin, require('./routes/faturacao.routes'))

// ---- só admin
App.use('/api/utilizadores', exigirLogin, exigirPerfil('admin'), require('./routes/utilizadores.routes'))

// ---- definições: ler = todos com sessão; alterar = admin (decidido dentro do ficheiro)
App.use('/api/definicoes', exigirLogin, require('./routes/definicoes.routes'))

// ---- análise: admin e gestor
App.use('/api/analise', exigirLogin, exigirPerfil('admin', 'gestor'), require('./routes/analise.routes'))

App.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }))

// eslint-disable-next-line no-unused-vars
App.use((erro, req, res, next) => {
  if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' })
  if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'Pedido demasiado grande.' })
  console.error('Erro não tratado:', erro.message)
  res.status(500).json({ erro: 'Erro no servidor.' })
})

App.listen(PORT, () => {
  console.log(`servidor rodando na porta:${PORT}`)
})
