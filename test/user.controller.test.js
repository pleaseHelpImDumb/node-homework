require("dotenv").config();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { EventEmitter } = require("events");
const waitForRouteHandlerCompletion = require("./waitForRouteHandlerCompletion");

const prisma = require("../db/prisma");
const httpMocks = require("node-mocks-http");
const { register, logoff, logon } = require("../controllers/userController");
const jwtMiddleware = require("../middleware/jwtMiddleware");
const jwt = require("jsonwebtoken");

// a few useful globals
let saveRes = null;
let saveData = null;

const cookie = require("cookie");
function MockResponseWithCookies({ eventEmitter: EventEmitter }) {
  const res = httpMocks.createResponse({ eventEmitter: EventEmitter });
  res.cookie = (name, value, options = {}) => {
    // this adds the function to the res, so that it stores cookies
    const serialized = cookie.serialize(name, String(value), options);
    let currentHeader = res.getHeader("Set-Cookie");
    if (currentHeader === undefined) {
      currentHeader = [];
    }
    currentHeader.push(serialized);
    res.setHeader("Set-Cookie", currentHeader);
  };
  return res;
}

beforeAll(async () => {
  // clear database
  await prisma.Task.deleteMany(); // delete all tasks
  await prisma.User.deleteMany(); // delete all users
});

afterAll(() => {
  prisma.$disconnect();
});

let jwtCookie;

describe("testing logon, register, and logoff", () => {
  it("33. A user can be registered.", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: { name: "Bob", email: "bob@sample.com", password: "Pa$$word20" },
    });
    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(register, req, saveRes);
    saveData = saveRes;
    expect(saveRes.statusCode).toBe(201); // success!
  });
  it("34. The user can logon.", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: { email: "bob@sample.com", password: "Pa$$word20" },
    });
    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(logon, req, saveRes);
    expect(saveRes.statusCode).toBe(200); // success!
  });
  it('35. A string in the cookie array starts with "jwt=".', async () => {
    const cookies = saveRes.get("Set-Cookie");
    jwtCookie = cookies.find((str) => str.startsWith("jwt="));
    expect(jwtCookie).toBeDefined();
  });
  it('36. That string contains "HttpOnly;".  (This is a security test!)', async () => {
    expect(jwtCookie).toContain("HttpOnly;");
  });
  it("37. The returned data from the register has the expected name.", async () => {
    //console.log(saveData._getJSONData());
    expect(saveData._getJSONData().user.name).toBe("Bob");
  });
  it("38. The returned data contains a csrfToken.", async () => {
    expect(saveData._getJSONData().csrfToken).toBeDefined();
  });
  it("39. You can now logoff.", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      headers: {
        cookie: jwtCookie,
        "X-CSRF-Token": saveRes._getJSONData().csrfToken,
      },
    });
    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(logoff, req, saveRes);
    expect(saveRes.statusCode).toBe(200);
  });
  it("40. The logoff clears the cookie.", () => {
    const setCookieArray = saveRes.get("Set-Cookie");
    jwtCookie = setCookieArray.find((str) => str.startsWith("jwt="));
    expect(jwtCookie).toContain("Jan 1970");
  });

  it("41. A logon attempt with a bad password returns a 401.", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: { email: "bob@sample.com", password: "pass" },
    });
    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(logon, req, saveRes);
    expect(saveRes.statusCode).toBe(401);
  });
  it("42. You can't register with an email address that is already registered.", async () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: { name: "NotBob", email: "bob@sample.com", password: "Pa$$word40" },
    });
    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });
    await waitForRouteHandlerCompletion(register, req, saveRes);
    console.log(saveRes);
    expect(saveRes.statusCode).toBe(400);
  });
});

describe("Testing JWT middleware", () => {
  let req;
  it("61. Returns a 401 if the JWT cookie is not present in the req.", async () => {
    req = httpMocks.createRequest({
      method: "POST",
    });

    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });

    await waitForRouteHandlerCompletion(jwtMiddleware, req, saveRes);

    expect(saveRes.statusCode).toBe(401);
  });
  it("62. Returns a 401 if the JWT is invalid", async () => {
    req = httpMocks.createRequest({
      method: "POST",
    });

    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });

    const jwtCookie = jwt.sign({ id: 5, csrfToken: "badToken" }, "badSecret", {
      expiresIn: "1h",
    });

    req.cookies = { jwt: jwtCookie };

    await waitForRouteHandlerCompletion(jwtMiddleware, req, saveRes);

    expect(saveRes.statusCode).toBe(401);
  });
  it("63. Returns a 401 if the JWT is valid but the CSRF token isn't", async () => {
    req = httpMocks.createRequest({
      method: "POST",
    });

    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });

    const jwtCookie = jwt.sign(
      { id: 5, csrfToken: "badToken" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    req.cookies = { jwt: jwtCookie };

    if (!req.headers) {
      req.headers = {};
    }
    req.headers["X-CSRF-TOKEN"] = "goodToken";

    await waitForRouteHandlerCompletion(jwtMiddleware, req, saveRes);

    expect(saveRes.statusCode).toBe(401);
  });
  it("64. Calls next() if both the token and the jwt are good", async () => {
    req = httpMocks.createRequest({
      method: "POST",
    });

    saveRes = MockResponseWithCookies({ eventEmitter: EventEmitter });

    const jwtCookie = jwt.sign(
      { id: 5, csrfToken: "goodToken" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    req.cookies = { jwt: jwtCookie };

    if (!req.headers) {
      req.headers = {};
    }
    req.headers["X-CSRF-TOKEN"] = "goodToken";

    const next = await waitForRouteHandlerCompletion(
      jwtMiddleware,
      req,
      saveRes,
    );

    expect(next).toHaveBeenCalled();
  });
  it("65. If both the token and the jwt are good, req.user.id has the appropriate value", () => {
    expect(req.user.id).toBe(5);
  });
});
