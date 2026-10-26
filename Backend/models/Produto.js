const crypto = require('crypto');
const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Produto = sequelize.define('Produto', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  uuid: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
  codigo: { type: DataTypes.STRING(40), unique: true },
  codigo_barras: { type: DataTypes.STRING(40), unique: true },
  nome: { type: DataTypes.STRING(150), allowNull: false },
  descricao: { type: DataTypes.TEXT },
  categoria_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  fornecedor_id: { type: DataTypes.INTEGER.UNSIGNED },
  taxa_iva_id: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  preco_custo: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0, validate: { min: 0 } },
  preco_venda: { type: DataTypes.DECIMAL(15, 2), allowNull: false, validate: { min: 0 } },
  stock_atual: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
  stock_minimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5, validate: { min: 0 } },
  unidade: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'un' },
  foto: { type: DataTypes.STRING(255) },
  qr_token: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  qr_imagem: { type: DataTypes.STRING(255) },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  criado_por: { type: DataTypes.INTEGER.UNSIGNED },
}, {
  tableName: 'produtos',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: 'atualizado_em',
  hooks: {
    // Gera automaticamente o uuid e o token do QR ao criar o produto
    beforeValidate: (produto) => {
      if (produto.isNewRecord) {
        if (!produto.uuid) produto.uuid = crypto.randomUUID();
        if (!produto.qr_token) produto.qr_token = crypto.randomBytes(32).toString('hex');
      }
    },
  },
});

module.exports = Produto;
