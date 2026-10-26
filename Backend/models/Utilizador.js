const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Utilizador = sequelize.define('Utilizador', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  nome: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
  senha_hash: { type: DataTypes.STRING(255), allowNull: false },
  perfil: { type: DataTypes.ENUM('admin', 'gestor', 'vendedor'), allowNull: false, defaultValue: 'vendedor' },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  ultimo_login: { type: DataTypes.DATE },
  tentativas_login: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
  bloqueado_ate: { type: DataTypes.DATE },
}, {
  tableName: 'utilizadores',
  timestamps: true,
  createdAt: 'criado_em',
  updatedAt: 'atualizado_em',
  // O hash da senha NUNCA sai nas consultas normais.
  // Para o login usa: Utilizador.scope('comSenha').findOne(...)
  defaultScope: { attributes: { exclude: ['senha_hash'] } },
  scopes: { comSenha: { attributes: { include: ['senha_hash'] } } },
});

module.exports = Utilizador;
