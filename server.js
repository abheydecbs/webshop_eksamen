const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = 3000;

// Routers
const { router: authRouter } = require('./routes/auth');
const produkterRouter = require('./routes/produkter');
const ordreRouter = require('./routes/ordre');
const kurvRouter = require('./routes/kurv');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/produkter', produkterRouter);
app.use('/api/ordre', ordreRouter);
app.use('/api/kurv', kurvRouter);

// Start server
app.listen(PORT, () => {
    console.log(`Server kører på http://localhost:${PORT}`);
    console.log(`API ordre kan ses på http://localhost:${PORT}/api/ordre`);
    console.log(`Ordre kan ses på http://localhost:${PORT}/ordre.html`);
});
