require('dotenv').config();
const app = require('./src/app');
const connectToDb = require('./src/db/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await connectToDb();
        app.listen(PORT, () => {
            console.log(`Server is running on ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }
}

startServer();
