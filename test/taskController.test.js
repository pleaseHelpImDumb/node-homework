require("dotenv").config();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL; // point to the test database!
const prisma = require("../db/prisma");
const httpMocks = require("node-mocks-http");

const { EventEmitter } = require("events"); // ADD THIS
const waitForRouteHandlerCompletion = require("./waitForRouteHandlerCompletion"); // ADD THIS

const {
  index,
  show,
  create,
  update,
  deleteTask,
} = require("../controllers/taskController");

// a few useful globals
let user1 = null;
let user2 = null;
let saveRes = null;
let saveData = null;
let saveTaskId = null;

beforeAll(async () => {
  // clear database
  await prisma.Task.deleteMany(); // delete all tasks
  await prisma.User.deleteMany(); // delete all users
  user1 = await prisma.User.create({
    data: { name: "Bob", email: "bob@sample.com", hashed_password: "nonsense" },
  });
  user2 = await prisma.User.create({
    data: {
      name: "Alice",
      email: "alice@sample.com",
      hashed_password: "nonsense",
    },
  });
});

afterAll(() => {
  prisma.$disconnect();
});

describe("testing task creation", () => {
  it("14. cant create a task without a user id", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: { title: "first task" },
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    try {
      await waitForRouteHandlerCompletion(create, req, saveRes);
    } catch (e) {
      expect(e.name).toBe("TypeError");
    }
  });

  it("15. You can't create a task with a bogus user id.", async () => {
    expect.assertions(1);
    const req = httpMocks.createRequest({
      method: "POST",
      body: { title: "first task" },
      user: { id: -123 }, //bogus id?
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    try {
      await waitForRouteHandlerCompletion(create, req, saveRes);
    } catch (e) {
      expect(e.name).toBe("PrismaClientKnownRequestError");
    }
  });

  it("16. If you have a valid user id, create() succeeds", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: { title: "first task" },
      user: { id: user1.id },
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(create, req, saveRes);
    saveTaskId = saveRes._getJSONData().id; // SAVE IT HERE for later tests
    expect(saveRes.statusCode).toBe(201);
  });

  it("17. The object returned from the create() call has the expected title.", async () => {
    expect(saveRes._getJSONData().title).toBe("first task");
  });

  it("18. The object has the right value for isCompleted.", async () => {
    expect(saveRes._getJSONData().isCompleted).toBe(false);
  });

  it("19. The object does not have any value for userId.", async () => {
    expect(saveRes._getJSONData().userId).toBeUndefined();
  });
});

describe("testing getting created tasks", () => {
  it("20. You can't get a list of tasks without a user id.", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    try {
      await waitForRouteHandlerCompletion(create, req, saveRes);
    } catch (e) {
      expect(e.name).toBe("TypeError");
    }
  });

  it("21. If you use user1's id on index() the call returns a 200 status.", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      user: { id: user1.id },
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(index, req, saveRes);
    expect(saveRes.statusCode).toBe(200);
  });

  it("22. The returned object has a tasks array of length 1.", async () => {
    saveData = saveRes._getJSONData(); // reusing saveRes
    expect(saveData.tasks.length).toBe(1);
  });

  it("23. The title in the first array object is as expected.", async () => {
    saveData = saveRes._getJSONData(); // reusing saveRes
    expect(saveData.tasks[0].title).toBe("first task");
  });

  it("24. The first array object does not contain a userId.", async () => {
    saveData = saveRes._getJSONData(); // reusing saveRes
    expect(saveData.tasks[0].userId).toBeUndefined();
  });

  it("25. If you get the list of tasks using the userId from user2, you get a 404.", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      user: { id: user2.id },
    });
    const res = httpMocks.createResponse({ eventEmitter: EventEmitter }); // NEW response!
    await waitForRouteHandlerCompletion(index, req, res); // Actually call index with user2
    expect(res.statusCode).toBe(404);
  });

  it("26. You can retrieve the created task using show().", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      user: { id: user1.id },
      params: { id: saveTaskId.toString() },
    });
    const res = httpMocks.createResponse({ eventEmitter: EventEmitter }); // NEW response!
    await waitForRouteHandlerCompletion(show, req, res); // Actually call index with user2
    expect(res.statusCode).toBe(200);
  });

  it("27. User2 can't retrieve a user1 task entry with show().", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      user: { id: user2.id },
      params: { id: saveTaskId.toString() },
    });
    const res = httpMocks.createResponse({ eventEmitter: EventEmitter }); // NEW response!
    await waitForRouteHandlerCompletion(show, req, res); // Actually call index with user2
    expect(res.statusCode).toBe(404);
  });
});

describe("updating and deleting tasks", () => {
  it("28. User1 can set the task corresponding to saveTaskId to isCompleted: true.", async () => {
    const req = httpMocks.createRequest({
      method: "PATCH",
      user: { id: user1.id },
      params: { id: saveTaskId.toString() },
      body: { isCompleted: true },
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(update, req, saveRes);
    expect(saveRes._getJSONData().isCompleted).toBe(true);
  });

  it("29. User2 cannot set the task corresponding to saveTaskId to isCompleted: true.", async () => {
    const req = httpMocks.createRequest({
      method: "PATCH",
      user: { id: user2.id },
      params: { id: saveTaskId.toString() },
      body: { isCompleted: true },
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(update, req, saveRes);
    expect(saveRes.statusCode).toBe(404); // User2 can't access user1's task!
  });

  it("30. User2 cannot delete the task with saveTaskId.", async () => {
    const req = httpMocks.createRequest({
      method: "PATCH",
      user: { id: user2.id },
      params: { id: saveTaskId.toString() },
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(deleteTask, req, saveRes);
    expect(saveRes.statusCode).toBe(404); // User2 can't access user1's task!
  });

  it("31. User1 CAN delete the task with saveTaskId.", async () => {
    const req = httpMocks.createRequest({
      method: "PATCH",
      user: { id: user1.id },
      params: { id: saveTaskId.toString() },
    });
    saveRes = httpMocks.createResponse({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(deleteTask, req, saveRes);

    console.log("Delete response:", saveRes._getJSONData()); // Debug

    expect(saveRes.statusCode).toBe(200);
    //expect(saveRes._getJSONData().id).toBe(saveTaskId);
    //expect(saveRes._getJSONData().title).toBe("first task");
  });

  it("32. Retrieving user1's tasks now returns a 404.", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      user: { id: user1.id },
    });
    const res = httpMocks.createResponse({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(index, req, res);
    expect(res.statusCode).toBe(404);
  });
});
