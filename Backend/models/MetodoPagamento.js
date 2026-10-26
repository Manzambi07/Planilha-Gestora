const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const MetodoPagamento = sequelize.define('MetodoPagamento', {
  id: { type: DataTypes.TINYINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'metodos_pagamento',
  timestamps: false,
});

module.exports = MetodoPagamento;
