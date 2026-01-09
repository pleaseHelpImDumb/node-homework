const { userSchema } = require("../validation/userSchema.js");
const { StatusCodes } = require("http-status-codes");

// DB
const prisma = require("../db/prisma.js");
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
  const hashed_password = await hashPassword(value.password);
  const { name, email } = value;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { name, email, hashed_password },
        select: { name: true, email: true, id: true },
      });

      const welcomeTaskData = [
        {
          title: "Complete your profile",
          userId: newUser.id,
          priority: "medium",
        },
        { title: "Add your first task", userId: newUser.id, priority: "high" },
        { title: "Explore the app", userId: newUser.id, priority: "low" },
      ];
      await tx.task.createMany({ data: welcomeTaskData });

      const welcomeTasks = await tx.task.findMany({
        where: {
          userId: newUser.id,
          title: { in: welcomeTaskData.map((t) => t.title) },
        },
        select: {
          id: true,
          title: true,
          isCompleted: true,
          userId: true,
          priority: true,
        },
      });

      return { user: newUser, welcomeTasks: welcomeTasks };
    });

    global.user_id = result.user.id;
    res.status(201);
    res.json({
      user: result.user,
      welcomeTasks: result.welcomeTasks,
      transactionStatus: "success",
    });
    return;
  } catch (e) {
    if (e.name === "PrismaClientKnownRequestError" && e.code == "P2002") {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Email already registered" });
    }
    return next(e);
  }
};

const logon = async (req, res) => {
  const lower_email = req.body.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: lower_email } });

  if (!user) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Authentication Failed." });
  }

  const isMatch = await comparePassword(
    req.body.password,
    user.hashed_password
  );

  if (isMatch) {
    global.user_id = user.id;
    return res.status(StatusCodes.OK).json({
      name: user.name,
      email: user.email,
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
