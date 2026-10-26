const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Auditoria = sequelize.define('Auditoria', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  utilizador_id: { type: DataTypes.INTEGER.UNSIGNED },
  acao: { type: DataTypes.STRING(50), allowNull: false },
  tabela: { type: DataTypes.STRING(50), allowNull: false },
  registo_id: { type: DataTypes.INTEGER.UNSIGNED },
  detalhes: { type: DataTypes.JSON },
  ip: { type: DataTypes.STRING(45) },
}, {
  tableName: 'auditoria',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: false,
});

module.exports = Auditoria;
