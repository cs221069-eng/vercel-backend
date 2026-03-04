const mongoose = require('mongoose');

let cached = global.__mongooseCache;

if (!cached) {
    cached = global.__mongooseCache = {
        conn: null,
        promise: null
    };
}

async function connectToDb() {
    const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;

    if (!mongoUrl) {
        throw new Error('Missing database connection string. Set MONGO_URL or MONGODB_URI.');
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(mongoUrl, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 10000
            })
            .then((mongooseInstance) => mongooseInstance)
            .catch((error) => {
                cached.promise = null;
                throw error;
            });
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

module.exports = connectToDb;
