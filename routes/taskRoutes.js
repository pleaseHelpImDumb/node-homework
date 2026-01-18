const express = require("express");

const router = express.Router();

const jwtMiddleware = require("../middleware/jwtMiddleware.js");

const {
  create,
  index,
  show,
  update,
  deleteTask,
  bulkCreate,
} = require("../controllers/taskController");

router.use(jwtMiddleware);

router.route("/").post(create).get(index);

router.route("/bulk").post(bulkCreate);

router.route("/:id").get(show).patch(update).delete(deleteTask);

module.exports = router;
