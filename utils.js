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
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM users WHERE name = ?",
    [name]
  );
  return rows[0].count < 1;
}

export async function addUserToDB(name, hashedPassword) {
  await pool.query("INSERT INTO users (name, password) VALUES (?, ?)", [
    name,
    hashedPassword,
  ]);
}
export async function getUserByName(name) {
  const [rows] = await pool.query("SELECT * FROM users WHERE name = ?", [name]);

  return rows[0];
}

export async function getFilesByName(name, limit, offset) {
  const [rows] = await pool.query(
    "SELECT * FROM usersFiles WHERE username = ? LIMIT ? OFFSET ?",
    [name, limit, offset]
  );
  const files = rows.map((row) => ({
    ...row,
    data: row.data.toString("base64"),
  }));

  const [[{ count }]] = await pool.query(
    "SELECT COUNT(*) AS count FROM usersFiles WHERE username = ?",
    [name]
  );
  return {
    files,
    total: count
  };
}

export async function addFile(username, name, tag, file, extention) {
  const [rows] = await pool.query(
    "INSERT INTO usersFiles (filename, mime_type, size, data, username, tag, originalname, extention) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
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
  return rows;
}

export async function getFile(id) {
  const [rows] = await pool.query("SELECT * FROM usersFiles WHERE id = ?", [
    id,
  ]);
  const file = rows[0];
  return file;
}

export async function getFileByOriginalName(name) {
  const [rows] = await pool.query(
    "SELECT * FROM usersFiles WHERE originalname = ?",
    [name]
  );
  const count = rows.length;
  return count;
}

export async function deleteFile(id) {
  const [rows] = await pool.query("DELETE FROM usersFiles WHERE id = ?", [id]);

  return rows;
}
