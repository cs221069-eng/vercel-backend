const mongoose = require('mongoose');

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
    throw new Error('MONGO_URL is not defined in environment variables');
}

let cached = global.__mongooseCache;

if (!cached) {
    cached = global.__mongooseCache = {
        conn: null,
        promise: null
    };
}

async function connectToDb() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose
            .connect(MONGO_URL, {
                maxPoolSize: 10
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
