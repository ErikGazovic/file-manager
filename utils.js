import pool from "./db.js";

export function isEmpty(value) {
  return value.trim() === "";
}

export function isTooLong(value, number) {
  return value.length > number;
}

export function doesntContain(value, symbol) {
  return !value.includes(symbol);
}

export function dontMatch(value, otherValue) {
  return value === otherValue;
}

export async function userExistsInDB(name) {
  const result = await pool.query(
    "SELECT COUNT(*) AS count FROM users WHERE name = $1",
    [name]
  );

  return Number(result.rows[0].count) < 1;
}

export async function addUserToDB(name, hashedPassword) {
  await pool.query(
    "INSERT INTO users (name, password) VALUES ($1, $2)",
    [name, hashedPassword]
  );
}
export async function getUserByName(name) {
  const result = await pool.query(
    "SELECT * FROM users WHERE name = $1",
    [name]
  );

  return result.rows[0];
}

export async function getFilesByName(name, limit, offset) {
  const result = await pool.query(
    "SELECT * FROM usersfiles WHERE username = $1 LIMIT $2 OFFSET $3",
    [name, limit, offset]
  );

  const files = result.rows.map((row) => ({
    ...row,
    data: row.data.toString("base64"),
  }));

  const countResult = await pool.query(
    "SELECT COUNT(*) AS count FROM usersfiles WHERE username = $1",
    [name]
  );

  return {
    files,
    total: Number(countResult.rows[0].count),
  };
}

export async function addFile(username, name, tag, file, extention) {
  const result = await pool.query(
    `INSERT INTO usersfiles
    (filename, mime_type, size, data, username, tag, originalname, extention)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      name,
      file.mimeType,
      file.size,
      file.data,
      username,
      tag,
      file.originalname,
      extention,
    ]
  );

  return result.rows;
}

export async function getFile(id) {
  const result = await pool.query(
    "SELECT * FROM usersfiles WHERE id = $1",
    [id]
  );

  return result.rows[0];
}

export async function getFileByOriginalName(name) {
  const result = await pool.query(
    "SELECT * FROM usersfiles WHERE originalname = $1",
    [name]
  );

  return result.rows.length;
}

export async function deleteFile(id) {
  const result = await pool.query(
    "DELETE FROM usersfiles WHERE id = $1",
    [id]
  );

  return result.rows;
}
