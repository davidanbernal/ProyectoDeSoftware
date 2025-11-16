const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const crypto = require('crypto');
const path = require('path');
const FormData = require('form-data');
const https = require('https');
const bcrypt = require('bcrypt');
const { Console } = require('console');
require('dotenv').config();
const moment = require('moment');


const app = express();
const PORT = process.env.PORT || 3001;


app.set('views',path.resolve(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use( express.static(path.join(__dirname, 'public')))
app.use('/assets',express.static(__dirname + '/public/css'));
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));



// Configuración del pool de conexiones con manejo de reconexión
const pool = mysql.createPool({
    connectionLimit: 80, // Número máximo de conexiones en el pool
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: 'control_acceso',
    // Configuración de reconexión
    acquireTimeout: 3000, // Tiempo de espera para adquirir una conexión
    connectTimeout: 3000, // Tiempo de espera para conectar
    waitForConnections: true, // Esperar conexiones si el pool está lleno
    queueLimit: 0 // Número máximo de conexiones en cola (0 = sin límite)
});

// Aumentar el límite de listeners a 20
pool.on('newListener', (event, listener) => {
    if (event === 'error') {
      pool.setMaxListeners(20);
    }
  });

// Función para manejar errores de conexión y reconectar
function handleDisconnect() {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error conectando a la base de datos:', err);
            setTimeout(handleDisconnect, 5000); // Intentar reconectar después de 2 segundos
        } else {
            console.log('Conectado a la base de datos MySQL');
            if (connection) connection.release();
        }
    });

    pool.on('error', (err) => {
        console.error('Error en la base de datos:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect(); // Reconectar si la conexión se pierde
        } else {
            throw err;
        }
    });
}

handleDisconnect(); // Iniciar el manejo de reconexión

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index');
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
});