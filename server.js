import express from "express";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import multer from "multer";
import {
  isEmpty,
  isTooLong,
  dontMatch,
  userExistsInDB,
  addUserToDB,
  getUserByName,
  getFilesByName,
  addFile,
  getFile,
  getFileByOriginalName,
  deleteFile,
} from "./utils.js";
import cors from "cors";
import pool from "./db.js";
import iconv from "iconv-lite";

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 8;

app.use(
  cors({
    origin: "http://file-manager-fd.s3-website.eu-north-1.amazonaws.com",
    methods: ["GET", "POST"],
  }),
);
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        reject(err);
      } else {
        resolve(hash);
      }
    });
  });
}
async function createTables() {
  

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usersfiles (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      originalname VARCHAR(255),
      mime_type VARCHAR(100) NOT NULL,
      size INT NOT NULL,
      data BYTEA NOT NULL,
      username VARCHAR(100),
      tag VARCHAR(50),
      extention VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      password VARCHAR(100)
    );
  `);
}

app.post("/register-user", async (req, res) => {
  const { name, password, reppeatedPassword } = req.body;
  console.log("registering user...");
  if (isEmpty(name) || isEmpty(password)) {
    console.log("Some of the fields are empty");
    return res.json({ message: "Niektoré polia sú nevyplnené", status: 401 });
  } else if (isTooLong(name, 100)) {
    console.log("Some of the fields are too long");
    return res.json({
      message: "Niektoré polia sú moc dlhé",
      status: 401,
    });
  } else if (!dontMatch(password, reppeatedPassword)) {
    console.log("Passwords do not match");
    return res.json({ message: "Heslá sa nezhodujú", status: 401 });
  } else {
    if (await userExistsInDB(name)) {
      const hashedPassword = await hashPassword(password);
      await addUserToDB(name, hashedPassword);

      return res.json({
        message: "Používateľ bol úspešne registrovaný",
        status: 200,
      });
    } else {
      return res.json({
        message: "Používateľ s týmto menom už existuje",
        status: 400,
      });
    }
  }
});

app.post("/login", async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({
        message: "Niektoré polia sú nevyplnené",
      });
    }

    const user = await getUserByName(name);

    if (!user) {
      return res.status(404).json({
        message: "Používateľ s týmto menom sa nenašiel",
      });
    }

    const storedHashedPassword = user.password;

    const result = await bcrypt.compare(password, storedHashedPassword);

    if (!result) {
      return res.status(401).json({
        message: "Nesprávne heslo",
      });
    }

    return res.json({
      message: "Successfuly logged in",
      name: user.name,
      status: 200,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

app.get("/get-files/:name", async (req, res) => {
  console.log("initiating getting all the files...");
  const username = req.params.name;
  const page = Number(req.query.page) || 0;
  const limit = Number(req.query.limit) || 7;
  const offset = page * limit;
  const safeLimit = Math.max(0, Number(limit));
  const safeOffset = Math.max(0, Number(offset));
  if (!username) {
    return res.status(402).json({
      errorType: "Missing user name",
      errorMessage: "Could not find the user",
    });
  }
if (req.query.tags) {
  const tagsString = req.query.tags;
  const tags = tagsString.split(",");

  const tagPlaceholders = tags.map((_, i) => `$${i + 1}`).join(",");

  const usernameIndex = tags.length + 1;
  const limitIndex = tags.length + 2;
  const offsetIndex = tags.length + 3;

  const sql = `
    SELECT * FROM usersfiles
    WHERE tag IN (${tagPlaceholders})
    AND username = $${usernameIndex}
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `;

  const countQuery = `
    SELECT COUNT(*) AS count
    FROM usersfiles
    WHERE tag IN (${tagPlaceholders})
    AND username = $${usernameIndex}
  `;

  const countResult = await pool.query(countQuery, [...tags, username]);

  const result = await pool.query(sql, [
    ...tags,
    username,
    safeLimit,
    safeOffset,
  ]);
console.log("Getting all the files");
  return res.json({
    files: result.rows,
    total: Number(countResult.rows[0].count),
  });
}});

const upload = multer({ storage: multer.memoryStorage() });
app.post("/add-file/:name", upload.single("file"), async (req, res) => {
  const username = req.params.name;
  const { name, tag } = req.body;
  const file = req.file;
  let safeOriginalName = file.originalname;
  try {
    safeOriginalName = iconv.decode(
      Buffer.from(file.originalname, "binary"),
      "utf8",
    );
  } catch (err) {
    console.error("Error decoding filename:", err);
  }

  if (!name || !tag || !file) {
    return res
      .status(400)
      .json({ error: "Missing data", message: "Niektoré polia sú nevyplnené" });
  }

  const fileRecord = {
    filename: name,
    originalname: safeOriginalName,
    mimeType: file.mimetype,
    size: file.size,
    data: file.buffer,
  };

  const count = await getFileByOriginalName(fileRecord.originalname);
  let extenction;
  function getExtention(fileName) {
    let lastDot;
    lastDot = fileName.indexOf(".", fileName.length - 4);
    if (lastDot === -1) {
      lastDot = fileName.indexOf(".", fileName.length - 5);
    }
    extenction = fileName.substring(lastDot, fileName.length);
    return extenction;
  }
  if (count > 0) {
    extenction = getExtention(fileRecord.originalname);
    let firstPart = fileRecord.originalname.split(".")[0];
    let fixedDuplacite = firstPart + ` (${count})` + extenction;
    fileRecord.originalname = fixedDuplacite;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    await addFile(
      username,
      name,
      tag,
      fileRecord,
      getExtention(fileRecord.originalname),
    );
    setTimeout(() => {
      return res.json({
        message: "Súbor sa úspešne pridal",
        status: 200,
      });
    }, 500);
  } catch (err) {
    return res.status(404).send(err);
  }
});

app.put("/change-file/:id", async (req, res) => {
  const name = req.query.name;
  const tag = req.query.tag;
  const id = req.params.id;
await pool.query(
  "UPDATE usersfiles SET filename = $1, tag = $2 WHERE id = $3",
  [name, tag, id]
);

const result = await pool.query(
  "SELECT * FROM usersfiles WHERE id = $1",
  [id]
);
  res.json(result);
});

app.get("/download/:id", async (req, res) => {
  const file = await getFile(req.params.id);
  res.setHeader("Content-Type", file.mime_type);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=""${encodeURIComponent(file.filename)}""`,
  );
  res.send(file.data);
});

app.post("/delete/:id", async (req, res) => {
  const file = await getFile(req.params.id);
  await deleteFile(file.id);
  return res.status(200).json({ message: `${file.filename}` });
});

async function startServer() {
  await createTables();
  console.log("Creating tables...");
  app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
}

startServer();



