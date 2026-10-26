const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Fatura = sequelize.define('Fatura', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  serie_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  numero: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  numero_completo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  tipo: { type: DataTypes.ENUM('FT', 'FR', 'NC', 'ND', 'OR'), allowNull: false, defaultValue: 'FR' },
  cliente_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  utilizador_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  fatura_origem_id: { type: DataTypes.INTEGER.UNSIGNED },
  data_emissao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  data_vencimento: { type: DataTypes.DATEONLY },
  subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  desconto_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  iva_total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  estado: {
    type: DataTypes.ENUM('rascunho', 'emitida', 'paga', 'parcial', 'anulada'),
    allowNull: false,
    defaultValue: 'rascunho',
  },
  motivo_anulacao: { type: DataTypes.STRING(255) },
  hash_documento: { type: DataTypes.CHAR(64) },
  observacoes: { type: DataTypes.TEXT },
}, {
  tableName: 'faturas',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: 'atualizado_em',
  indexes: [{ unique: true, fields: ['serie_id', 'numero'] }],
  hooks: {
    // Segunda barreira (a primeira é o trigger no MySQL)
    beforeDestroy: () => {
      throw new Error('Faturas não podem ser apagadas. Use anulação ou nota de crédito.');
    },
  },
});

module.exports = Fatura;
