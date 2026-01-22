const express = require("express");
const jwtMiddleware = require("../middleware/jwtMiddleware.js");

const router = express.Router();
const { register, logon, logoff } = require("../controllers/userController");

router.route("/").post(register);
router.route("/register").post(register);

router.route("/logon").post(logon);

router.use(jwtMiddleware);
router.route("/logoff").post(logoff);

module.exports = router;
