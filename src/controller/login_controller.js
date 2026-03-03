const adminModel = require('../models/admin_model');
const userModel = require('../models/user_model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function signAuthToken(payload) {
    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
    );
}

function setAuthCookie(res, token) {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    });
}

function clearAuthCookie(res) {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
}

async function Login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    try {
        const existingAdmin = await adminModel.findOne({ email });

        if (existingAdmin) {
            const isAdminPasswordMatch = await bcrypt.compare(password, existingAdmin.password);
            if (!isAdminPasswordMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const token = signAuthToken({
                accountId: existingAdmin._id,
                email: existingAdmin.email,
                role: 'admin',
                accountType: 'admin'
            });

            setAuthCookie(res, token);

            return res.status(200).json({
                success: true,
                message: 'Login successful',
                token,
                accountId: existingAdmin._id,
                email: existingAdmin.email,
                role: 'admin',
                redirect: '/admin-dashboard-1'
            });
        }

        const existingUser = await userModel.findOne({ email });
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isUserPasswordMatch = await bcrypt.compare(password, existingUser.password);
        if (!isUserPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = signAuthToken({
            accountId: existingUser._id,
            email: existingUser.email,
            role: existingUser.role,
            accountType: 'user'
        });

        setAuthCookie(res, token);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            accountId: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            redirect: existingUser.role === 'teacher'
                ? '/teacher-dashboard-1'
                : '/student-dashboard-1'
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to login',
            error: err.message
        });
    }
}

function Logout(req, res) {
    clearAuthCookie(res);
    return res.status(200).json({
        success: true,
        message: 'Logout successful'
    });
}

module.exports = { Login, Logout, LoginAdmin: Login };
