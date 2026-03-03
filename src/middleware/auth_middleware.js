const jwt = require('jsonwebtoken');

function parseCookieToken(cookieHeader) {
    if (!cookieHeader || typeof cookieHeader !== 'string') return '';
    const parts = cookieHeader.split(';');
    const tokenPart = parts.find((part) => part.trim().startsWith('token='));
    if (!tokenPart) return '';
    return decodeURIComponent(tokenPart.trim().slice('token='.length));
}

function extractToken(req) {
    const authHeader = req.headers?.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }
    return parseCookieToken(req.headers?.cookie);
}

function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.auth = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

function authorizeRoles(...roles) {
    return (req, res, next) => {
        const role = req?.auth?.role;
        if (!role || !roles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'You are not allowed to access this resource'
            });
        }
        return next();
    };
}

module.exports = {
    requireAuth,
    authorizeRoles
};
