const prisma = require("../db/prisma");
const { StatusCodes } = require("http-status-codes");

const { paginationSchema } = require("../validation/taskSchema.js");

const getUserAnalytics = async (req, res, next) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId)) {
    return res
      .status(400)
      .json({ message: "The task ID passed is not valid." });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const taskStats = await prisma.task.groupBy({
      by: ["isCompleted"],
      where: { userId: userId },
      _count: {
        id: true,
      },
    });

    const recentTasks = await prisma.task.findMany({
      where: { userId: userId },
      select: {
        id: true,
        title: true,
        isCompleted: true,
        priority: true,
        createdAt: true,
        userId: true,
        User: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const weeklyTasks = await prisma.task.findMany({
      where: {
        userId: userId,
        createdAt: { gte: oneWeekAgo },
      },
      select: { createdAt: true },
    });

    const progressMap = {};
    weeklyTasks.forEach((task) => {
      const dateKey = task.createdAt.toISOString().split("T")[0];
      if (progressMap[dateKey]) {
        progressMap[dateKey]++;
      } else {
        progressMap[dateKey] = 1;
      }
    });

    const weeklyProgress = Object.keys(progressMap).map((date) => ({
      createdAt: date,
      _count: { id: progressMap[date] },
    }));

    return res.status(200).json({ taskStats, recentTasks, weeklyProgress });
  } catch (err) {
    return next(err);
  }
};

const getUsersWithStats = async (req, res) => {
  try {
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

    const { page, limit } = value;
    const skip = (page - 1) * limit;

    const usersRaw = await prisma.user.findMany({
      include: {
        Task: {
          where: { isCompleted: false },
          select: { id: true },
          take: 5,
        },
        _count: {
          select: {
            Task: true,
          },
        },
      },
      skip: skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    const users = usersRaw.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      _count: user._count,
      Task: user.Task,
    }));

    const totalUsers = await prisma.user.count();
    const totalPages = Math.ceil(totalUsers / limit);
    const pagination = {
      page: page,
      limit: limit,
      total: totalUsers,
      pages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return res.status(200).json({
      users,
      pagination,
    });
  } catch (error) {
    console.error("Error in getUsersWithStats:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const searchTasks = async (req, res, next) => {
  const searchQuery = req.query.q;
  if (!searchQuery || searchQuery.length < 2) {
    return res
      .status(400)
      .json({ error: "Search query must be at least 2 characters long" });
  }

  const limit = parseInt(req.query.limit) || 20;
  const searchPattern = `%${searchQuery}%`; // Contains
  const exactMatch = searchQuery; // Exact
  const startsWith = `${searchQuery}%`; // Prefix

  try {
    const results = await prisma.$queryRaw`
      SELECT 
        t.id,
        t.title,
        t.is_completed as "isCompleted",
        t.priority,
        t.created_at as "createdAt",
        t.user_id as "userId",
        u.name as "user_name"
      FROM tasks t
      JOIN users u ON t.user_id = u.id
      WHERE t.title ILIKE ${searchPattern} 
         OR u.name ILIKE ${searchPattern}
      ORDER BY 
        CASE 
          WHEN t.title ILIKE ${exactMatch} THEN 1 
          WHEN t.title ILIKE ${startsWith} THEN 2 
          WHEN t.title ILIKE ${searchPattern} THEN 3 
          ELSE 4 
        END,
        t.created_at DESC
      LIMIT ${limit}
    `;

    // 5. Return formatted response
    res.status(200).json({
      results,
      query: searchQuery,
      count: results.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsersWithStats,
  getUserAnalytics,
  searchTasks,
};
