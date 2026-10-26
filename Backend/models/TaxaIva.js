const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const TaxaIva = sequelize.define('TaxaIva', {
  id: { type: DataTypes.TINYINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  descricao: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  percentagem: { type: DataTypes.DECIMAL(5, 2), allowNull: false, validate: { min: 0, max: 100 } },
  motivo_isencao: { type: DataTypes.STRING(150) },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'taxas_iva',
  timestamps: false,
});

module.exports = TaxaIva;
