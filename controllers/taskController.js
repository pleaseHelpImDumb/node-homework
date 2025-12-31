const { StatusCodes } = require("http-status-codes");
const { taskSchema, patchTaskSchema } = require("../validation/taskSchema.js");
// DB
const prisma = require("../db/prisma.js");
// --

const create = async (req, res, next) => {
  if (!req.body) req.body = {};
  const { error, value } = taskSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json(error);
  }
  const { title, isCompleted } = value;
  try {
    const task = await prisma.task.create({
      data: {
        title,
        is_completed: isCompleted,
        user_id: global.user_id,
      },
    });

    //need to map for TDD
    const responseTask = {
      id: task.id,
      title: task.title,
      isCompleted: task.is_completed,
    };
    res.status(StatusCodes.CREATED).json(responseTask);
  } catch (error) {
    next(error);
  }
};

const index = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        user_id: global.user_id,
      },
      select: { title: true, is_completed: true, id: true },
    });

    if (tasks.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "No tasks found." });
    }

    if (!tasks) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "No tasks found for this user." });
    }

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Error fetching tasks." });
  }
};

const show = async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res
      .status(400)
      .json({ message: "The task ID passed is not valid." });
  }

  try {
    const task = await prisma.task.findUnique({
      where: {
        id_user_id: {
          id: id,
          user_id: global.user_id,
        },
      },
      select: {
        id: true,
        title: true,
        is_completed: true,
      },
    });

    if (!task) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Task not found." });
    }

    res.status(200).json(task);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "The task was not found." });
    }
    next(error);
  }
};

const update = async (req, res, next) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res
      .status(400)
      .json({ message: "The task ID passed is not valid." });
  }

  const { error, value } = patchTaskSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json(error);
  }

  try {
    const task = await prisma.task.update({
      data: {
        title: value.title,
        is_completed: value.isCompleted,
      },
      where: {
        id_user_id: {
          id: id,
          user_id: global.user_id,
        },
      },
      select: { title: true, is_completed: true, id: true },
    });

    res.json(task);
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "The task was not found." });
    }
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "The task ID passed is not valid." });
  }

  try {
    const deletedTask = await prisma.task.delete({
      where: {
        id_user_id: {
          id: id,
          user_id: global.user_id,
        },
      },
      select: {
        id: true,
        title: true,
        is_completed: true,
      },
    });

    return res.json(deletedTask);
  } catch (error) {
    // 4. Handle "Not Found"
    if (error.code === "P2025") {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "That task was not found" });
    }
    next(error);
  }
};

module.exports = { create, index, show, update, deleteTask };
