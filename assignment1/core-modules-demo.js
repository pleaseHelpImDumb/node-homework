const os = require("os");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises"); //

const sampleFilesDir = path.join(__dirname, "sample-files");
if (!fs.existsSync(sampleFilesDir)) {
  fs.mkdirSync(sampleFilesDir, { recursive: true });
}

// OS module
console.log("Platform: ", os.platform());
console.log("CPU:", os.cpus()[0].model, "@", os.cpus()[0].speed / 1000, "GHz");
console.log("Total Memory:", os.totalmem());
// Path module
const joinedPath = path.join("/path/to", "sample-files", "folder/file.txt");
console.log("Joined path: ", joinedPath);

// fs.promises API
const fspWrite = async () => {
  try {
    await fsp.writeFile(
      __dirname + "/sample-files/demo.txt",
      "Hello from fs.promises!"
    );
  } catch (err) {
    console.log(err);
  }
};
const fspRead = async () => {
  try {
    let data = await fsp.readFile(__dirname + "/sample-files/demo.txt", "utf8");
    console.log("fs.promises read:", data);
  } catch (err) {
    console.log(err);
  }
};

// Streams for large files- log first 40 chars of each chunk
const fspWriteLarge = async () => {
  try {
    let text =
      "The fs/promises API provides asynchronous file system methods that return promises.\nThe promise APIs use the underlying Node.js threadpool to perform file system operations off the event loop thread.\nThese operations are not synchronized or threadsafe. Care must be taken when performing multiple concurrent modifications on the same file or data corruption may occur.\n";

    await fsp.writeFile(__dirname + "/sample-files/largefile.txt", "");
    for (let i = 1; i < 100; i++) {
      await fsp.appendFile(__dirname + "/sample-files/largefile.txt", text);
    }
  } catch (err) {
    console.log(err);
  }
};

const fspReadStream = () => {
  const rs = fs.createReadStream(__dirname + "/sample-files/largefile.txt", {
    encoding: "utf8",
    highWaterMark: 1024,
  });

  rs.on("data", (chunk) => {
    console.log("Read chunk: ", chunk.substring(0, 40));
  });

  rs.on("end", () => {
    console.log("Finished reading large file with streams.");
  });
};

// for printing in order
const consoleLog = async () => {
  await fspWrite();
  await fspRead();
  await fspWriteLarge();
  await fspReadStream();
};
consoleLog();
