require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const AdminRouter = require('./router/admin_routes');
const loginRouter  =require('./router/auth_routes');
const userRouter = require('./router/user_routes');

const defaultOrigins = ['http://localhost:5173'];
const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials:true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth',AdminRouter);
app.use('/api/auth',loginRouter);
app.use('/api/user',userRouter);

module.exports = app;
