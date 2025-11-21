const express = require("express");

const app = express();
app.use(express.json());
// the following statements configure the chain of middleware and route handlers.  Nothing happens with them until a request is received.

app.use((req, res, next) => {
  // this is called for every request received.  All methods, all paths
  req.additional = { this: 1, that: "two" };
  const content = req.get("content-type");
  if (req.method == "POST" && content != "application/json") {
    next(new Error("A bad content type was received")); // this invokes the error handler
  } else {
    next(); // as OK data was received, the request is passed on to it.
  }
});

app.post("/test", (req, res) => {
  res.json({
    message: "POST received!",
    content: req.body,
    additional: req.additional,
  });
});

app.get("/info", (req, res) => {
  // this is only called for get requests for the specific path
  res.send("We got good stuff here!");
});

app.use("/api", (req, res, next) => {
  // this is called for all methods, but only if the path begins with /api
  // and only if the request got past that first middleware.
  // ...
});

app.use((req, res) => {
  // this is the not found handler.  Nothing took care of the request, so we send the caller the bad news.  You always need one of these.
  res.status(404).send("That route is not present.");
});

app.use((err, req, res, next) => {
  // The error handler.  You always need one.
  console.log(err.constructor.name, err.message, err.stack);
  res.status(500).send("internal server error");
});

let server = null;

try {
  server = app.listen(3000);
  console.log("server up and running.");
} catch {
  console.log("couldn't get access to the port.");
}
