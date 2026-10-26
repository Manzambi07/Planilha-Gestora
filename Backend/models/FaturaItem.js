const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const FaturaItem = sequelize.define('FaturaItem', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  fatura_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  produto_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  descricao: { type: DataTypes.STRING(150), allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(12, 3), allowNull: false, validate: { min: 0.001 } },
  preco_unitario: { type: DataTypes.DECIMAL(15, 2), allowNull: false, validate: { min: 0 } },
  desconto: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0, validate: { min: 0 } },
  iva_percentagem: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  iva_valor: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  total_linha: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
}, {
  tableName: 'fatura_itens',
  timestamps: false,
});

module.exports = FaturaItem;
