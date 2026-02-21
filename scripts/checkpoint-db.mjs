import Database from "better-sqlite3";

const db = new Database("server/data/ife-store.db");
const result = db.pragma("wal_checkpoint(TRUNCATE)");
console.log(JSON.stringify(result));
db.close();
