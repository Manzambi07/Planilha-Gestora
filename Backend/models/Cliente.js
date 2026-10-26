const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Cliente = sequelize.define('Cliente', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(150), allowNull: false },
  nif: { type: DataTypes.STRING(20), unique: true },
  telefone: { type: DataTypes.STRING(30) },
  email: { type: DataTypes.STRING(150), validate: { isEmail: true } },
  endereco: { type: DataTypes.STRING(255) },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'clientes',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: 'atualizado_em',
});

module.exports = Cliente;
