const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Pagamento = sequelize.define('Pagamento', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  fatura_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  metodo_id: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },
  valor: { type: DataTypes.DECIMAL(15, 2), allowNull: false, validate: { min: 0.01 } },
  referencia: { type: DataTypes.STRING(100) },
  data_pagamento: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  utilizador_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, {
  tableName: 'pagamentos',
  timestamps: false,
});

module.exports = Pagamento;
