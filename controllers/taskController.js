const { StatusCodes } = require("http-status-codes");
const {
  taskSchema,
  patchTaskSchema,
  paginationSchema,
} = require("../validation/taskSchema.js");
// DB
const prisma = require("../db/prisma.js");
// --

const create = async (req, res, next) => {
  if (!req.body) req.body = {};
  const { error, value } = taskSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json(error);
  }
  const { title, isCompleted, priority } = value;
  try {
    const task = await prisma.task.create({
      data: {
        title,
        isCompleted: isCompleted,
        userId: req.user.id,
        priority,
      },
    });
    const { userId, ...taskWithoutUserId } = task;
    res.status(StatusCodes.CREATED).json(taskWithoutUserId);
  } catch (error) {
    next(error);
  }
};

const bulkCreate = async (req, res, next) => {
  const { tasks } = req.body;

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      error: "Invalid request data. Expected an array of tasks.",
    });
  }

  const validTasks = [];
  for (const task of tasks) {
    const { error, value } = taskSchema.validate(task);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details,
      });
    }
    validTasks.push({
      title: value.title,
      isCompleted: value.isCompleted || false,
      priority: value.priority || "medium",
      userId: req.user.id,
    });
  }

  try {
    const result = await prisma.task.createMany({
      data: validTasks,
      skipDuplicates: false,
    });

    res.status(201).json({
      message: "success!",
      tasksCreated: result.count,
      totalRequested: validTasks.length,
    });
  } catch (err) {
    return next(err);
  }
};

const index = async (req, res) => {
  const { error, value } = paginationSchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: "Invalid pagination parameters",
      details: error.details.map((err) => err.message),
    });
  }
  const { page, limit, find } = value;

  const skip = (page - 1) * limit;

  const whereClause = { userId: req.user.id };

  if (find) {
    whereClause.title = {
      contains: req.query.find,
      mode: "insensitive",
    };
  }

  try {
    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        title: true,
        isCompleted: true,
        id: true,
        priority: true,
        createdAt: true,
        User: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      skip: skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const totalTasks = await prisma.task.count({
      where: whereClause,
    });

    if (tasks.length === 0 && totalTasks === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "No tasks found." });
    }

    if (!tasks) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "No tasks found for this user." });
    }

    const totalPages = Math.ceil(totalTasks / limit);

    const pagination = {
      page: page,
      pages: totalPages,
      total: totalTasks,
      limit: limit,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    res.status(StatusCodes.OK).json({ tasks, pagination });
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
        id_userId: {
          id: id,
          userId: req.user.id,
        },
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        User: {
          select: {
            name: true,
            email: true,
          },
        },
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
        isCompleted: value.isCompleted,
        priority: value.priority,
      },
      where: {
        id_userId: {
          id: id,
          userId: req.user.id,
        },
      },
      select: { title: true, isCompleted: true, id: true, priority: true },
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
        id_userId: {
          id: id,
          userId: req.user.id,
        },
      },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
      },
    });

    return res.json(deletedTask);
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "That task was not found" });
    }
    next(error);
  }
};

module.exports = { create, index, show, update, deleteTask, bulkCreate };
