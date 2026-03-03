require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const AdminRouter = require('./router/admin_routes');
const loginRouter  =require('./router/auth_routes');
const userRouter = require('./router/user_routes');

app.use(cors({
    origin:'http://localhost:5173',
    credentials:true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth',AdminRouter);
app.use('/api/auth',loginRouter);
app.use('/api/user',userRouter);

module.exports = app;
