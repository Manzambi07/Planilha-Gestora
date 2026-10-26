const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Empresa = sequelize.define('Empresa', {
  id: { type: DataTypes.TINYINT.UNSIGNED, primaryKey: true, defaultValue: 1 },
  nome: { type: DataTypes.STRING(150), allowNull: false },
  nif: { type: DataTypes.STRING(20), allowNull: false },
  endereco: { type: DataTypes.STRING(255) },
  telefone: { type: DataTypes.STRING(30) },
  email: { type: DataTypes.STRING(150), validate: { isEmail: true } },
  logotipo: { type: DataTypes.STRING(255) },
  moeda: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'AOA' },
}, {
  tableName: 'empresa',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: 'atualizado_em',
});

module.exports = Empresa;
