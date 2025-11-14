const fs = require("fs");
const fsp = require("fs/promises");

// Write a sample file for demonstration

// 1. Callback style
// Callback hell example (test and leave it in comments):
// 2. Promise style
// 3. Async/Await style

const writeSample = async () => {
  fs.writeFile(
    __dirname + "/sample-files/sample.txt",
    "Hello, async world!",
    (err) => {
      if (err) {
        console.log(err);
      }
    }
  );
};

//Basic read file
const readFile = async () => {
  fs.readFile(__dirname + "/sample-files/sample.txt", "utf8", (err, data) => {
    if (err) {
      console.log("Error: ", err);
    } else {
      console.log("Callback read:", data);
    }
  });
};

/*
The previous function is a callback function with (err, data)=>{}
If readFile has an error, it is logged on line 14
If successful, the 'data' (contents of file) is logged

Callback hell would occur trying to write to a file.
For example, writing two lines to a file would look like this:

fs.open("./file", ..., (err, fileHandle) => {
  if(err) {console.log(err);}
  else{
      COOL! We have the handle. Now we can do stuff with it.
      But now writing requires another callback:
      
      fd.write(fd, 'some text!', (err) => {
        if(err){console.log('another error...');}
        
        COOL! We wrote the line! Now close the file...?
        fd.close(fd, (err) =>{
          ...
        });
      });
  }
});
*/

//Writing to 'writing.txt' with promises:
/*
const writeFile = async (fileName, text) => {
  try {
    const fh = await new Promise((resolve, reject) => {
      fs.open(fileName, "w", (err, fh) => {
        return err ? reject(err) : resolve(fh);
      });
    });

    await new Promise((resolve, reject) => {
      fs.write(fh, text, (err) => {
        return err ? reject(err) : resolve();
      });
    });

    await new Promise((resolve, reject) => {
      fs.close(fh, (err) => {
        return err ? reject(err) : resolve();
      });
    });
  } catch (err) {
    console.log(err);
  }
};
*/
//Reading with promises:
const readFilePromise = async (filePath) => {
  try {
    const data = await new Promise((resolve, reject) => {
      fs.readFile(filePath, "utf8", (err, data) => {
        return err ? reject(err) : resolve(data);
      });
    });
    console.log("Promise read: ", data);
  } catch (err) {
    console.log(err);
  }
};

//Reading with async/await
const readFileAwait = async (filePath) => {
  try {
    const data = await fsp.readFile(filePath, "utf8");
    console.log("Async/Await read: ", data);
  } catch (err) {
    console.log(err);
  }
};

const consoleLog = async () => {
  await writeSample();
  await readFile();
  await readFilePromise(__dirname + "/sample-files/sample.txt");
  await readFileAwait(__dirname + "/sample-files/sample.txt");
};

consoleLog();
