const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const MovimentoStock = sequelize.define('MovimentoStock', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  produto_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  tipo: { type: DataTypes.ENUM('entrada', 'venda', 'devolucao', 'ajuste', 'perda'), allowNull: false },
  quantidade: { type: DataTypes.INTEGER, allowNull: false }, // + entra, - sai
  stock_apos: { type: DataTypes.INTEGER, allowNull: false },
  fatura_id: { type: DataTypes.INTEGER.UNSIGNED },
  utilizador_id: { type: DataTypes.INTEGER.UNSIGNED },
  nota: { type: DataTypes.STRING(255) },
}, {
  tableName: 'movimentos_stock',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: false,
});

module.exports = MovimentoStock;
