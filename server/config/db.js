import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";

// Ensure DNS resolvers work across platforms (especially Windows with MongoDB Atlas SRV)
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // Ignore in environments where setting DNS servers is restricted
}

let cachedConnection = null;
let connectingPromise = null;

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  if (!uri) {
    console.warn("[Database] MONGODB_URI not set. Running without database connection.");
    return null;
  }

  try {
    const opts = {
      dbName: process.env.MONGODB_DB_NAME || "bugpilot",
      serverSelectionTimeoutMS: 20000,
      autoIndex: true,
      maxPoolSize: 10,
    };

    connectingPromise = mongoose.connect(uri, opts);
    const conn = await connectingPromise;
    cachedConnection = conn;
    connectingPromise = null;
    console.log(`[Database] Connected to MongoDB → database: ${opts.dbName}`);
    return conn;
  } catch (err) {
    connectingPromise = null;
    console.error("[Database] Connection failed:", err.message);
    throw err;
  }
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cachedConnection = null;
    console.log("[Database] Disconnected from MongoDB");
  }
}

// Graceful process cleanup
process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectDB();
  process.exit(0);
});
