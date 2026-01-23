require("dotenv").config();
const request = require("supertest");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const prisma = require("../db/prisma");
let agent;
let saveRes;
const { app, server } = require("../app");

beforeAll(async () => {
  // clear database
  await prisma.Task.deleteMany(); // delete all tasks
  await prisma.User.deleteMany(); // delete all users
  agent = request.agent(app);
});

afterAll(async () => {
  prisma.$disconnect();
  server.close();
});

describe("register a user ", () => {
  let saveRes = null;

  it("46. it creates the user entry", async () => {
    const newUser = {
      name: "John Deere",
      email: "jdeere@example.com",
      password: "Pa$$word20",
    };
    saveRes = await agent.post("/api/users/register").send(newUser);
    expect(saveRes.status).toBe(201);
  });

  it("47. Registration returns an object with the expected name.", async () => {
    expect(saveRes.body.user.name).toBe("John Deere");
  });

  it("48. Test that the returned object includes a csrfToken.", async () => {
    expect(saveRes.body.csrfToken).toBeDefined(); // Check the saved token
  });

  it("49. You can logon as the newly registered user.", async () => {
    const creds = {
      email: "jdeere@example.com",
      password: "Pa$$word20",
    };
    saveRes = await agent.post("/api/users/logon").send(creds);
    expect(saveRes.status).toBe(200);
  });

  it("50. You can logoff.", async () => {
    saveRes = await agent
      .post("/api/users/logoff")
      .set("X-CSRF-Token", saveRes.body.csrfToken);
    expect(saveRes.status).toBe(200);
  });
});
