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

function isAllowedVercelOrigin(origin) {
    return /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
}

function isAllowedNetlifyOrigin(origin) {
    return /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin);
}

const corsOptions = {
    origin(origin, callback) {
        if (
            !origin ||
            allowedOrigins.includes(origin) ||
            isAllowedVercelOrigin(origin) ||
            isAllowedNetlifyOrigin(origin)
        ) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/api/health/9165', (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'API is running',
        commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
        branch: process.env.VERCEL_GIT_COMMIT_REF || 'local'
    });
});

app.use('/api/admin',AdminRouter);
app.use('/api/auth',AdminRouter);
app.use('/api/auth',loginRouter);
app.use('/api/user',userRouter);

module.exports = app;
