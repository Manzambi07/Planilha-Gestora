require('dotenv').config()
const { Sequelize } = require('sequelize')

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false,
        timezone: '+01:00',
        dialectOptions: { decimalNumbers: true }
    }
)

const funcionar = async () => {
    try {
        await sequelize.authenticate()
        console.log('ligado ao mysql')
    } catch (erro) {
        console.log('erro ao ligar ao mysql:', erro.message)
    }
}

funcionar()

module.exports = sequelize