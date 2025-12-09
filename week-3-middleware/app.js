const express = require("express");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const dogsRouter = require("./routes/dogs");

const app = express();

// ******************
// CUSTOM ERROR CLASSES
// ******************
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnauthorizedError";
    this.statusCode = 401;
  }
}

// make id for all requests
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader("X-Request-Id", req.id);
  next();
});

// logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]: ${req.method} ${req.path} (${req.id})`);
  next();
});

// security
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// for JSON bodies
app.use(express.json());
// size limiting
express.json({ limit: "1mb" });
express.urlencoded({ limit: "1mb" });

// for images
app.use("/images", express.static(path.join(__dirname, "public/images")));

// ******************
// REQUEST VALIDATION
// ******************
app.use("/", (req, res, next) => {
  if (req.method === "POST" && !req.is("application/json")) {
    return res.status(400).json({
      error: "Content-Type must be application/json",
      requestId: req.id,
    });
  }
  next();
});

app.use("/", dogsRouter); // Do not remove this line

// ******************
// 404 HANDLER
// ******************
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    requestId: req.id,
  });
});

// ******************
// ERROR HANDLER
// ******************
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Log with different severity levels and proper format
  if (statusCode >= 500) {
    console.error(`ERROR: ${err.name}: ${err.message}`);
  } else if (statusCode >= 400) {
    console.warn(`WARN: ${err.name}: ${err.message}`);
  } else {
    console.log(`INFO: ${err.name}: ${err.message}`);
  }

  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal Server Error" : err.message,
    requestId: req.id,
  });
});

// SERVER
const server = app.listen(3000, () =>
  console.log("Server listening on port 3000")
);
module.exports = server;
