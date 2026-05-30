"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
var client_1 = require("@prisma/client");
var pg_1 = require("pg");
var adapter_pg_1 = require("@prisma/adapter-pg");
var globalForPrisma = globalThis;
var pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
var adapter = new adapter_pg_1.PrismaPg(pool);
exports.db = (_a = globalForPrisma.prisma) !== null && _a !== void 0 ? _a : new client_1.PrismaClient({
    adapter: adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.db;
