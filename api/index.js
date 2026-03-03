require('dotenv').config();
const app = require('../src/app');
const connectToDb = require('../src/db/db');

module.exports = async (req, res) => {
    try {
        await connectToDb();
        return app(req, res);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
};
