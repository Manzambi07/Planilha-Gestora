require('dotenv').config()
const fs = require('fs')
const { Sequelize } = require('sequelize')

Sequelize.postgres.DECIMAL.parse = (valor) => parseFloat(valor)

// Ligação cifrada. Com DB_SSL_CA (caminho do certificado da autoridade do Supabase) o servidor da base de
// dados é VERIFICADO, o que protege contra interceção. Sem DB_SSL_CA mantém-se o comportamento anterior.
const ssl = process.env.DB_SSL !== 'true'
    ? false
    : process.env.DB_SSL_CA
        ? { require: true, rejectUnauthorized: true, ca: fs.readFileSync(process.env.DB_SSL_CA, 'utf8') }
        : { require: true, rejectUnauthorized: false }
if (process.env.DB_SSL === 'true' && !process.env.DB_SSL_CA) {
    console.warn('aviso: DB_SSL_CA não definido, o certificado da base de dados não está a ser verificado')
}

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        timezone: '+01:00',
        dialectOptions: { ssl }
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