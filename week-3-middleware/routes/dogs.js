const express = require("express");
const router = express.Router();
const dogs = require("../dogData.js");

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

router.get("/dogs", (req, res) => {
  res.json(dogs);
});

router.post("/adopt", (req, res, next) => {
  try {
    const { dogName, name, email } = req.body;

    if (!dogName || !name || !email) {
      throw new ValidationError(
        "Missing required fields: dogName, name, and email are required"
      );
    }

    const dogNames = dogs.map((dog) => dog.name);
    if (!dogNames.includes(dogName)) {
      throw new NotFoundError(
        `Dog '${dogName}' not found or not available for adoption`
      );
    }

    // Success response
    res.status(201).json({
      message: `Adoption request received. We will contact you at ${email} for further details.`,
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/error", (req, res) => {
  throw new Error("Test error");
});

module.exports = router;
