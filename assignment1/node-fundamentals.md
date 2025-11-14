# Node.js Fundamentals

## What is Node.js?

Node.js is basically Javascript that can run locally on a machine without any sandbox restrictions.

## How does Node.js differ from running JavaScript in the browser?

<<<<<<< HEAD
We can't access stuff like the DOM or the screen. Instead, we have benefits like accessing the file system, storing secrets, or starting processes of the local machine. And even though they run on the same V8 engine,
JS in the browser uses its own Web APIs (DOM, window, etc), while Node has its Node APIs (fs, os, path)
=======
We can't access stuff like the DOM or the screen. Instead, we have benefits like accessing the file system, storing secrets, or starting processes of the local machine.

> > > > > > > e280e2a (Assignment 1)

## What is the V8 engine, and how does Node use it?

The V8 engine is basically what runs JS code, developed by Google for their Chrome browser. Node uses it alongside some modules/libraries to let us access files which the browser can't do.

## What are some key use cases for Node.js?

It's better for storing secrets like passwords/keys, building web apps, and it's better for real-time apps.

## Explain the difference between CommonJS and ES Modules. Give a code example of each.

**CommonJS (default in Node.js):**

CJS uses require() and module.exports. for syntax.
It's synchronous (runtime), and Node.js's default.

```js
//circle.js:
const { PI } = Math;
exports.area = (r) => PI * r ** 2;
//main.js
const circle = require("./circle.js"); //CJS uses require()
console.log(`The area of a circle of radius 2 is ${circle.area(4)}`);
```

**ES Modules (supported in modern Node.js):**

ES came from browsers and is more modern.
It uses import/export syntax and is asynchronous.

```js
// circle.mjs
const { PI } = Math;
export function area(r) {
  return PI * r ** 2;
}
// main.js
import { area } from ".circle.mjs"; //import like from React
console.log(`The area of a circle of radius 2 is ${area(4)}`);
```
