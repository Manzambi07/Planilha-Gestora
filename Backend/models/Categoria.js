const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Categoria = sequelize.define('Categoria', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  descricao: { type: DataTypes.STRING(255) },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'categorias',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: 'atualizado_em',
});

module.exports = Categoria;
