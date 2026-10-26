const sequelize = require('../database');

const Empresa = require('./Empresa');
const Utilizador = require('./Utilizador');
const Categoria = require('./Categoria');
const Fornecedor = require('./Fornecedor');
const TaxaIva = require('./TaxaIva');
const Produto = require('./Produto');
const Cliente = require('./Cliente');
const SerieDocumento = require('./SerieDocumento');
const MetodoPagamento = require('./MetodoPagamento');
const Fatura = require('./Fatura');
const FaturaItem = require('./FaturaItem');
const Pagamento = require('./Pagamento');
const MovimentoStock = require('./MovimentoStock');
const Auditoria = require('./Auditoria');

// ---------- Produtos ----------
Categoria.hasMany(Produto, { foreignKey: 'categoria_id', as: 'produtos' });
Produto.belongsTo(Categoria, { foreignKey: 'categoria_id', as: 'categoria' });

Fornecedor.hasMany(Produto, { foreignKey: 'fornecedor_id', as: 'produtos' });
Produto.belongsTo(Fornecedor, { foreignKey: 'fornecedor_id', as: 'fornecedor' });

TaxaIva.hasMany(Produto, { foreignKey: 'taxa_iva_id', as: 'produtos' });
Produto.belongsTo(TaxaIva, { foreignKey: 'taxa_iva_id', as: 'taxaIva' });

Utilizador.hasMany(Produto, { foreignKey: 'criado_por', as: 'produtosCriados' });
Produto.belongsTo(Utilizador, { foreignKey: 'criado_por', as: 'criador' });

// ---------- Faturas ----------
SerieDocumento.hasMany(Fatura, { foreignKey: 'serie_id', as: 'faturas' });
Fatura.belongsTo(SerieDocumento, { foreignKey: 'serie_id', as: 'serie' });

Cliente.hasMany(Fatura, { foreignKey: 'cliente_id', as: 'faturas' });
Fatura.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });

Utilizador.hasMany(Fatura, { foreignKey: 'utilizador_id', as: 'faturas' });
Fatura.belongsTo(Utilizador, { foreignKey: 'utilizador_id', as: 'emitidaPor' });

Fatura.belongsTo(Fatura, { foreignKey: 'fatura_origem_id', as: 'faturaOrigem' });
Fatura.hasMany(Fatura, { foreignKey: 'fatura_origem_id', as: 'notasRelacionadas' });

Fatura.hasMany(FaturaItem, { foreignKey: 'fatura_id', as: 'itens', onDelete: 'CASCADE' });
FaturaItem.belongsTo(Fatura, { foreignKey: 'fatura_id', as: 'fatura' });

Produto.hasMany(FaturaItem, { foreignKey: 'produto_id', as: 'itensVendidos' });
FaturaItem.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// ---------- Pagamentos ----------
Fatura.hasMany(Pagamento, { foreignKey: 'fatura_id', as: 'pagamentos' });
Pagamento.belongsTo(Fatura, { foreignKey: 'fatura_id', as: 'fatura' });

MetodoPagamento.hasMany(Pagamento, { foreignKey: 'metodo_id', as: 'pagamentos' });
Pagamento.belongsTo(MetodoPagamento, { foreignKey: 'metodo_id', as: 'metodo' });

Utilizador.hasMany(Pagamento, { foreignKey: 'utilizador_id', as: 'pagamentos' });
Pagamento.belongsTo(Utilizador, { foreignKey: 'utilizador_id', as: 'recebidoPor' });

// ---------- Stock ----------
Produto.hasMany(MovimentoStock, { foreignKey: 'produto_id', as: 'movimentos' });
MovimentoStock.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

Fatura.hasMany(MovimentoStock, { foreignKey: 'fatura_id', as: 'movimentos' });
MovimentoStock.belongsTo(Fatura, { foreignKey: 'fatura_id', as: 'fatura' });

Utilizador.hasMany(MovimentoStock, { foreignKey: 'utilizador_id', as: 'movimentos' });
MovimentoStock.belongsTo(Utilizador, { foreignKey: 'utilizador_id', as: 'responsavel' });

// ---------- Auditoria ----------
Utilizador.hasMany(Auditoria, { foreignKey: 'utilizador_id', as: 'registos' });
Auditoria.belongsTo(Utilizador, { foreignKey: 'utilizador_id', as: 'utilizador' });

module.exports = {
  sequelize,
  Empresa,
  Utilizador,
  Categoria,
  Fornecedor,
  TaxaIva,
  Produto,
  Cliente,
  SerieDocumento,
  MetodoPagamento,
  Fatura,
  FaturaItem,
  Pagamento,
  MovimentoStock,
  Auditoria,
};
