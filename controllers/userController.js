const { userSchema } = require("../validation/userSchema.js");
const { StatusCodes } = require("http-status-codes");

// DB
const prisma = require("../db/prisma.js");
// --

// Password
const crypto = require("crypto");
const util = require("util");
const scrypt = util.promisify(crypto.scrypt);
// --

// Google Auth
const { OAuth2Client } = require("google-auth-library");
//

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

const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");

const cookieFlags = (req) => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // only when HTTPS is available
    sameSite: "Strict",
  };
};

const setJwtCookie = (req, res, user) => {
  // Sign JWT
  const payload = { id: user.id, csrfToken: randomUUID() };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" }); // 1 hour expiration
  // Set cookie.  Note that the cookie flags have to be different in production and in test.
  res.cookie("jwt", token, { ...cookieFlags(req), maxAge: 3600000 }); // 1 hour expiration
  return payload.csrfToken; // this is needed in the body returned by logon() or register()
};

const register = async (req, res, next) => {
  if (!req.body) req.body = {};

  // RECAPTCHA TEST
  let isPerson = false;
  if (req.body.recaptchaToken) {
    const token = req.body.recaptchaToken;
    const params = new URLSearchParams();
    params.append("secret", process.env.RECAPTCHA_SECRET);
    params.append("response", token);
    params.append("remoteip", req.ip);
    const response = await fetch(
      // might throw an error that would cause a 500 from the error handler
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        body: params.toString(),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );
    const data = await response.json();
    if (data.success) isPerson = true;
    delete req.body.recaptchaToken;
  } else if (
    process.env.RECAPTCHA_BYPASS &&
    req.get("X-Recaptcha-Test") === process.env.RECAPTCHA_BYPASS
  ) {
    // might be a test environment
    isPerson = true;
  }
  if (!isPerson) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "We can't tell if you're a person or a bot." });
  }

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
      const csrfToken = setJwtCookie(req, res, newUser);
      return {
        user: newUser,
        welcomeTasks: welcomeTasks,
        csrfToken: csrfToken,
      };
    });

    res.status(201);
    res.json({
      user: result.user,
      welcomeTasks: result.welcomeTasks,
      transactionStatus: "success",
      csrfToken: result.csrfToken,
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
    user.hashed_password,
  );

  if (isMatch) {
    const csrfToken = setJwtCookie(req, res, user);

    return res.status(StatusCodes.OK).json({
      name: user.name,
      email: user.email,
      csrfToken: csrfToken,
    });
  }

  return res
    .status(StatusCodes.UNAUTHORIZED)
    .json({ message: "Authentication Failed." });
};

const googleLogon = async (req, res) => {
  console.log("GOOGLE LOGON:");
  console.log("request body:", req.body);
  console.log("auth code:", req.body.code);

  if (!req.body.code) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Authentication Failed." });
  }

  try {
    //Google OAuth Client Stuff
    const client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    });
    const { tokens } = await client.getToken(req.body.code);
    client.setCredentials(tokens);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    // user's google info:
    //const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    //const picture = payload.picture;

    //find user in DB - match email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      //if not, create one (bogus password), add tasks and return 201
      const result = await prisma.$transaction(async (tx) => {
        const password = crypto.randomBytes(32).toString("hex");
        const hashed_password = await hashPassword(password);
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
          {
            title: "Add your first task",
            userId: newUser.id,
            priority: "high",
          },
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
        const csrfToken = setJwtCookie(req, res, newUser);
        return {
          user: newUser,
          welcomeTasks: welcomeTasks,
          csrfToken: csrfToken,
        };
      });

      res.status(201);
      res.json({
        user: result.user,
        welcomeTasks: result.welcomeTasks,
        transactionStatus: "success",
        csrfToken: result.csrfToken,
      });
      return;
    }

    //if yes, login
    const csrfToken = setJwtCookie(req, res, user);

    return res.status(StatusCodes.OK).json({
      name: name,
      email: email,
      csrfToken: csrfToken,
    });
  } catch (e) {
    console.log("GOOGLE-LOGON ERROR:", e);
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Authentication Failed." });
  }
};

const logoff = (req, res) => {
  res.clearCookie("jwt", cookieFlags(req));
  res.sendStatus(StatusCodes.OK);
};

module.exports = { register, logon, logoff, googleLogon };
