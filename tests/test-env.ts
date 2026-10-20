// Runs before vitest.setup.ts. The test setup deletes every row in the database,
// so refuse to run unless DATABASE_URL clearly points at a disposable test database.
import { config } from "dotenv";

config({ path: ".env.test", override: true, quiet: true });

const url = process.env.DATABASE_URL;
let dbName = "";
try {
  dbName = url ? new URL(url).pathname.replace(/^\//, "") : "";
} catch {
  // fall through to the error below
}

if (!dbName.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests: the test setup wipes the database, and DATABASE_URL ` +
      `points at "${dbName || "(unset)"}". Put a DATABASE_URL whose database name ` +
      `ends in "_test" in .env.test (see .env.test.example).`
  );
}
