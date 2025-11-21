const EventEmitter = require("events");

const emitter = new EventEmitter();

emitter.on("time", (msg) => {
  console.log("Time received:", msg);
});

setInterval(() => {
  emitter.emit("time", Date.now());
}, 5000);

module.exports = emitter;
