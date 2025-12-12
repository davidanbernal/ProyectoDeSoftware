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


app.set('views',path.resolve(__dirname, 'src/views'));
app.set('view engine', 'ejs');

//app.use( express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'src', 'public')));

//app.use('/assets',express.static(__dirname + 'public/css'));
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

app.get('/autorizacion', (req, res) => {
    res.render('autorizacion');
   
});
app.get('/registro', (req, res) => {
    res.render('registro');
   
});


///CONSULTAR OFICINAS///
 app.get('/oficinas', (req, res) => {
    const sql = 'SELECT id, oficina FROM oficinas ORDER BY oficina ASC';
  
    pool.query(sql, (err, rows) => {
      if (err) {
        console.error('Error listando oficinas:', err);
        return res.status(500).json({ success: false, message: 'Error consultando oficinas.' });
      }
      res.json({ success: true, data: rows });
    });
  });

///AUTORIZAR VISITANTE///
  app.post('/autorizar', (req, res) => {
    const { oficina, autoriza, contrasena, fecha, identificacion } = req.body;
  
    if (!oficina || !autoriza || !contrasena || !fecha || !identificacion) {
      return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios.' });
    }
  
    // 1) Consultar oficina (id + valor)
    const sqlOficina = `
      SELECT id, oficina
      FROM oficinas
      WHERE oficina = ?
      LIMIT 1
    `;
    pool.query(sqlOficina, [oficina], (errOficina, rowsOficina) => {
      if (errOficina) {
        console.error('Error consultando oficina:', errOficina);
        return res.status(500).json({ success: false, message: 'Error al consultar la oficina.' });
      }
  
      if (!rowsOficina || rowsOficina.length === 0) {
        return res.json({ success: false, message: 'Los datos de oficina y contraseña no son correctos. Vuelva a intentarlo.' });
      }
  
      const oficinaId = rowsOficina[0].id;
      const oficinaValor = rowsOficina[0].oficina;
  
      // 2) Validar usuario (oficina_id + contraseña)
      const sqlUsuario = `
        SELECT id
        FROM usuarios
        WHERE oficina_id = ?
          AND contrasena = ?
        LIMIT 1
      `;
      pool.query(sqlUsuario, [oficinaId, contrasena], (errUser, rowsUser) => {
        if (errUser) {
          console.error('Error consultando usuarios:', errUser);
          return res.status(500).json({ success: false, message: 'Error al validar oficina y contraseña.' });
        }
  
        if (!rowsUser || rowsUser.length === 0) {
          return res.json({ success: false, message: 'Los datos de oficina y contraseña no son correctos. Vuelva a intentarlo.' });
        }
  
        // 3) Validar duplicado (misma identificación + misma fecha)
        const sqlExiste = `
          SELECT id
          FROM visitantes
          WHERE identificacion = ?
            AND fecha_ingreso_autorizado = ?
          LIMIT 1
        `;
        pool.query(sqlExiste, [identificacion, fecha], (errExiste, rowsExiste) => {
          if (errExiste) {
            console.error('Error validando duplicado:', errExiste);
            return res.status(500).json({ success: false, message: 'Error al validar autorizaciones existentes.' });
          }
  
          if (rowsExiste && rowsExiste.length > 0) {
            return res.json({ success: false, message: 'Ya hay una autorización registrada para este documento en ese día.' });
          }
  
          // 4) Insertar autorización
          const sqlInsert = `
            INSERT INTO visitantes
              (identificacion, oficina_id, oficina, fecha_ingreso_autorizado, autorizo_nombre)
            VALUES (?, ?, ?, ?, ?)
          `;
          pool.query(
            sqlInsert,
            [identificacion, oficinaId, oficinaValor, fecha, autoriza],
            (errInsert) => {
              if (errInsert) {
                console.error('Error insertando autorización:', errInsert);
                return res.status(500).json({ success: false, message: 'No se pudo guardar la autorización.' });
              }
  
              return res.json({ success: true, message: 'La autorización fue realizada correctamente.' });
            }
          );
        });
      });
    });
  });
  
///BUSCAR AUTORIZACIÓN///
app.get('/busqueda', (req, res) => {
    const identificacion = String(req.query.identificacion || '').trim();
    const fecha = String(req.query.fecha || '').trim(); // YYYY-MM-DD
  
    if (!identificacion || !fecha) {
      return res.status(400).json({
        success: false,
        message: 'Identificación y fecha son obligatorias.'
      });
    }
  
    const sql = `
      SELECT id, identificacion, oficina, fecha_ingreso_autorizado, autorizo_nombre
      FROM visitantes
      WHERE identificacion = ?
        AND fecha_ingreso_autorizado = ?
      ORDER BY id DESC
      LIMIT 1
    `;
  
    pool.query(sql, [identificacion, fecha], (err, rows) => {
      if (err) {
        console.error('Error buscando autorización:', err);
        return res.status(500).json({ success: false, message: 'Error consultando autorización.' });
      }
  
      if (!rows || rows.length === 0) {
        return res.json({
          success: false,
          message: 'No hay autorización para esa identificación en la fecha de hoy.'
        });
      }
  
      return res.json({ success: true, data: rows[0] });
    });
  });
  
  
///REGISTRAR INGRESO///
  app.post('/registrar', (req, res) => {
    const { id, identificacion, nombre } = req.body;
  
    if (!id || !identificacion || !nombre) {
      return res.status(400).json({
        success: false,
        message: 'Datos incompletos para registrar.'
      });
    }
  
    const sql = `
      UPDATE visitantes
      SET nombre = ?, hora_ingreso = NOW()
      WHERE id = ? AND identificacion = ?
      LIMIT 1
    `;
  
    pool.query(sql, [nombre, id, identificacion], (err, result) => {
      if (err) {
        console.error('Error registrando ingreso:', err);
        return res.status(500).json({
          success: false,
          message: 'Error actualizando el registro del visitante.'
        });
      }
  
      if (!result || result.affectedRows === 0) {
        return res.json({
          success: false,
          message: 'No se encontró un registro válido para actualizar.'
        });
      }
  
      return res.json({
        success: true,
        message: 'Registro de ingreso realizado correctamente.'
      });
    });
  });
  



app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
});