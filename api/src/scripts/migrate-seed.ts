import { readFileSync } from "fs";
import { resolve } from "path";
import argon2 from "argon2";
import { pool, query } from "../shared/db/pool";

async function main() {
  if (!pool) {
    console.error("Define DATABASE_URL en .env");
    process.exit(1);
  }
  const schema = readFileSync(resolve(__dirname, "../../../sql/001_schema.sql"), "utf8");
  await pool.query(schema);
  console.log("Schema OK");

  const seedPath = resolve(__dirname, "../../../sql/002_seed.sql");
  await pool.query(readFileSync(seedPath, "utf8"));
  console.log("Questions seed OK");

  const users = [
    { email: "admin@eduquest.local", name: "Admin CFA", role: "admin", password: "Password123!" },
    { email: "docente@eduquest.local", name: "Docente Demo", role: "teacher", password: "Password123!" },
    { email: "alumno@eduquest.local", name: "Alumno Demo", role: "student", password: "Password123!" },
  ];
  for (const u of users) {
    const hash = await argon2.hash(u.password);
    await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, hash, u.name, u.role],
    );
  }
  console.log("Users seed OK (Password123!)");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});