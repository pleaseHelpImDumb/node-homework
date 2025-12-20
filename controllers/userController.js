const { userSchema } = require("../validation/userSchema.js");
const { StatusCodes } = require("http-status-codes");

// DB
const pool = require('../db/pg-pool.js');
// --

const crypto = require("crypto");
const util = require("util");
const scrypt = util.promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
} 

async function comparePassword(inputPassword, storedHash) {
  const [salt, key] = storedHash.split(":");
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = await scrypt(inputPassword, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

const register = async (req, res, next) => {
  if (!req.body) req.body = {};
  const { error, value } = userSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json(error);
  }
  let user = null;
  value.hashed_password = await hashPassword(value.password);

  try {
    user = await pool.query(`INSERT INTO users (email, name, hashed_password) 
      VALUES ($1, $2, $3) RETURNING id, email, name`,
      [value.email, value.name, value.hashed_password]
    );
  } catch(e){
    if (e.code === "23505"){
      res.status(StatusCodes.BAD_REQUEST).json({message:"This user is already registered."});
    }
    return next(e);
  }
  res.status(StatusCodes.CREATED).json({email:value.email, name:value.name});
};

const logon = async (req, res) => {
  //const user = global.users.find((user) => user.email == req.body.email);

  const user = await pool.query("SELECT * FROM users WHERE email = $1", [req.body.email]);

  if (user.rows.length == 0) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Authentication Failed." });
  }

  const isMatch = await comparePassword(req.body.password, user.rows[0].hashed_password);

  if (isMatch) {
    global.user_id = user.rows[0];
    return res.status(StatusCodes.OK).json({
      name: user.rows[0].name,
      email: user.rows[0].email,
    });
  }

  return res
    .status(StatusCodes.UNAUTHORIZED)
    .json({ message: "Authentication Failed." });
};

const logoff = (req, res) => {
  global.user_id = null;
  res.sendStatus(StatusCodes.OK);
};

module.exports = { register, logon, logoff };
