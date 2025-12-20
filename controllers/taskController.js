const { StatusCodes } = require("http-status-codes");
const { taskSchema, patchTaskSchema } = require("../validation/taskSchema.js");
// DB
const pool = require('../db/pg-pool.js');
// --

const create = async (req, res) => {
  if (!req.body) req.body = {};
  const { error, value } = taskSchema.validate(req.body, { abortEarly: false });
  if (error) {
    console.log("Validation error:", error);  // ADD THIS
    return res.status(StatusCodes.BAD_REQUEST).json(error);
  }
  
  console.log("Value after validation:", value);  // ADD THIS
  
  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, is_completed, user_id) 
       VALUES ($1, $2, $3) 
       RETURNING id, title, is_completed`,
      [value.title, value.isCompleted, global.user_id]
    );

    console.log("Query result:", result.rows[0]);  // ADD THIS

    res.status(StatusCodes.CREATED).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating task:", error);  // This should show the real error
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Error creating task." });
  }
};

const index = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, is_completed 
       FROM tasks 
       WHERE user_id = $1`,
      [global.user_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "No tasks found for this user." });
    }
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Error fetching tasks." });
  }
};

const show = async (req, res) => {
  const taskToFind = parseInt(req.params?.id); // if there are no params, the ? makes sure that you
  // get a null
  if (!taskToFind) {
    return res
      .status(400)
      .json({ message: "The task ID passed is not valid." });
  }

  try {
    const result = await pool.query(
      `SELECT id, title, is_completed 
       FROM tasks 
       WHERE id = $1 AND user_id = $2`,
      [taskToFind, global.user_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Task not found." });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching task:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Error fetching task." });
  }
};

const update = async (req, res) => {

  const taskToFind = parseInt(req.params?.id);

  if (!taskToFind) {
    return res
      .status(400)
      .json({ message: "The task ID passed is not valid." });
  }


  const { error, value } = patchTaskSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(StatusCodes.BAD_REQUEST).json(error);
  }

  const taskChange = value;
  //get columns to change
  const keys = Object.keys(taskChange);
  if (keys.length === 0) {
    return res
      .status(400)
      .json({ message: "No fields to update provided." });
  }

  const dbFields = {};
  if (taskChange.title !== undefined) dbFields.title = taskChange.title;
  if (taskChange.isCompleted !== undefined) dbFields.is_completed = taskChange.isCompleted;

  const dbKeys = Object.keys(dbFields);
  const setClauses = dbKeys.map((key, i) => `${key} = $${i + 1}`).join(", ");
  const idParam = `$${dbKeys.length + 1}`;
  const userParam = `$${dbKeys.length + 2}`;


  try {
    const result = await pool.query(
      `UPDATE tasks SET ${setClauses} 
       WHERE id = ${idParam} AND user_id = ${userParam} 
       RETURNING id, title, is_completed`,
      [...Object.values(dbFields), taskToFind, global.user_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Task not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating task:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Error updating task." });
  }
};

const deleteTask = async (req, res) => {
  const taskToFind = parseInt(req.params?.id); // if there are no params, the ? makes sure that you
  // get a null
  if (!taskToFind) {
    return res
      .status(400)
      .json({ message: "The task ID passed is not valid." });
  }
  try {
    const result = await pool.query(
      `DELETE FROM tasks 
       WHERE id = $1 AND user_id = $2 
       RETURNING id, title, is_completed`,
      [taskToFind, global.user_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "That task was not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error deleting task:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Error deleting task." });
  }
};

module.exports = { create, index, show, update, deleteTask };
