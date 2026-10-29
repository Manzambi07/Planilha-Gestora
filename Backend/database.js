require('dotenv').config()
const { Sequelize } = require('sequelize')

// O PostgreSQL devolve os DECIMAL (preços, totais) como texto. Isto devolve números,
// como o MySQL fazia com "decimalNumbers", para o resto do código continuar igual.
Sequelize.postgres.DECIMAL.parse = (valor) => parseFloat(valor)

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        timezone: '+01:00'
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
