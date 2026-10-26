const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const SerieDocumento = sequelize.define('SerieDocumento', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  tipo: { type: DataTypes.ENUM('FT', 'FR', 'NC', 'ND', 'OR'), allowNull: false },
  ano: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
  ultimo_numero: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'series_documentos',
  timestamps: false,
  indexes: [{ unique: true, fields: ['tipo', 'ano'] }],
});

module.exports = SerieDocumento;
