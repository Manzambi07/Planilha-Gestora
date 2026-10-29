require('dotenv').config()
const { Sequelize } = require('sequelize')

Sequelize.postgres.DECIMAL.parse = (valor) => parseFloat(valor)

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        timezone: '+01:00',
        dialectOptions: {
            ssl: process.env.DB_SSL === 'true'
                ? { require: true, rejectUnauthorized: false }
                : false
        }
    }
)

const funcionar = async () => {
    try {
        await sequelize.authenticate()
        console.log('ligado ao postgresql')
    } catch (erro) {
        console.log('erro ao ligar ao postgresql:', erro.message)
    }
}

funcionar()

module.exports = sequelize