# @appgeist/restful-api

[![NPM version][npm-image]][npm-url]
[![License][license-image]][license-url]

![AppGeist Restful API](https://user-images.githubusercontent.com/581999/61737471-f5aa8600-ad90-11e9-8059-cff04086f3bd.png)

An opinionated, [convention-over-configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) [Express](https://expressjs.com)-based restful API server featuring [yup](https://www.npmjs.com/package/yup) validation.

## Usage

### Initialization

You can use `@appgeist/restful-api` either as an _Express_ middleware:

```js
const express = require("express");
const api = require("@appgeist/restful-api");

const [host, port] = ["0.0.0.0", 3000];

express()
  // other middleware
  .use(api())
  // other middleware
  .listen(port, host, err => {
    if (err) throw err;
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://${host}:${port}...`);
  });
```

...or directly:

```js
const api = require("@appgeist/restful-api");

const [host, port] = ["0.0.0.0", 3000];

api().listen(port, host, err => {
  if (err) throw err;
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${host}:${port}...`);
});
```

When initializing `@appgeist/restful-api` you can optionally specify the folder containing the route handler definitions (defaults to `./routes`):

```js
const path = require("path");
const api = require("@appgeist/restful-api");

const [host, port] = ["0.0.0.0", 3000];

api(path.join(__dirname, "api-routes")).listen(port, host, err => {
  if (err) throw err;
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${host}:${port}...`);
});
```

### Defining route handlers

Name your route handler definition modules `get.js`, `post.js`, `put.js`, `patch.js` or `delete.js` and organize them in a meaningful folder structure that will get translated to rest API routes.

For instance:

```
routes/departments/get.js => GET /departments
routes/departments/post.js => POST /departments
routes/departments/[id]/patch.js => PATCH /departments/3
routes/departments/[id]/delete.js => DELETE /departments/3
routes/departments/[id]/employees/get.js => GET /departments/3/employees
routes/departments/[id]/employees/post.js => POST /departments/3/employees
routes/departments/[id]/employees/[id]/get.js => GET /departments/3/employees/165
routes/departments/[id]/employees/[id]/patch.js => PATCH /departments/3/employees/165
routes/departments/[id]/employees/[id]/delete.js => DELETE /departments/3/employees/165
```

Each module exports:

- `beforeRequest` - an optional before request handler function;
- `onRequest` - a mandatory request handler function;
- `paramsSchema`, `querySchema`, `bodySchema` - optional schemas to validate the incoming request params, query and body. These can be simple objects (for brevity, in which case they will be converted to _yup_ schemas automatically) or _yup_ schemas (for more complex scenarios, i.e. when you need to specify a `.noUnknown()` modifier).

A function handler accepts an optional object parameter in the form of `{ params, query, body, req }` and must return the data that will be sent back to the client, or a Promise resolving with the data.

For simple cases when you don't care about validation, you can export just the handler, like so: `module.exports = () => {/* handle request here... */};`.

### Nested paths

For nested paths, **ancestor-level parameter names are _magically_ renamed** with the help of [`pluralize.singular`](https://www.npmjs.com/package/pluralize):

`routes/departments/[id]/employees/[id]/get.js -> params: { departmentId, id }`
`routes/departments/[id]/employees/[id]/projects/[id]/get.js -> params: { departmentId, projectId, id }`

### Default error handling

#### Validation errors

When request data validation fails, the client will receive a response with HTTP status code `400`/`BAD_REQUEST` and a JSON body describing the error provided by [`yup.validate(data, { abortEarly: false })`](https://github.com/jquense/yup#mixedvalidatevalue-any-options-object-promiseany-validationerror):

```json
{
  "message": "There were 2 validation errors",
  "errors": ["body.name is required", "body.description is required"]
}
```

#### Throwing errors

If a function handler throws an `ApiError(httpStatusCode)` (also [exported](lib/ApiError.js) from this package), the client will receive a response with the specified HTTP status code and a JSON body like `{ "message": "Why it failed" }`.

The `ApiError` constructor accepts an HTTP status code number or an object structured like `{ status, message }`.

Using the constructor without parameters will result in a respose with HTTP status code `500` and the following JSON body:

```json
{
  "message": "Internal Server Error"
}
```

### Custom error handling

You can override the default error handling mechanism by providing a custom error handling function like so:

```js
const path = require("path");
const api = require("@appgeist/restful-api");

const [host, port] = ["0.0.0.0", 3000];

api(path.join(__dirname, "api-routes"), {
  errorHandler: ({ err, res }) => {
    res.status(500).send("Error");
    console.log(err.stack);
  }
}).listen(port, host, err => {
  if (err) throw err;
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${host}:${port}...`);
});
```

## Example

`routes/departments/get.js`:

```js
const Department = require("models/Department");

// simple handler, without validation
module.exports = () => Department.listAll();
// ...or exports.onRequest = () => Department.listAll();
```

`routes/departments/[id]/patch.js`:

```js
const { object, number } = require('yup');
const { FORBIDDEN } = require('http-status-codes');
const { ApiError } = require('@appgeist/rest-api');
const Department = require('models/Department');
const ACL = require('utils/acl');
const Logger = require('utils/logger');

// schema can be a simple object
exports.paramsSchema = {
  id: number().positive().integer().required()
};

// schema can be a yup object
exports.bodySchema = object({
  name: string().min(2).max(20).required()
  description: string().min(2).max(1000).required()
}).noUnknown();

exports.onRequest = async ({ params: { id }, body, req }) => {
  // throwing an ApiError(403) will result in a 403 status code being sent to the client
  if (!(ACL.isManager(req.userId))) throw new ApiError(FORBIDDEN);
  const department = await Department.updateById(id, { data: body });
  await Logger.log(`Department ${id} updated by user ${req.userId}`);
  return department;
}
```

`routes/departments/[id]/employees/[id]/get.js`:

```js
const { number } = require('yup');
const Department = require('models/Department');
const Employee = require('models/Employee');

exports.paramsSchema = {
  departmentId: number().positive().integer().required()
  id: number().positive().integer().required()
};

exports.beforeRequest = ({ url }) => {
  console.log(`Preparing to respond to ${url}`);
};

exports.onRequest = async ({ params: { departmentId, id } }) => {
  const employee = await Employee.getById(id);
  employee.department = await Department.getById(departmentId);
  return employee;
}
```

## License

The [ISC License](LICENSE).

[npm-image]: https://img.shields.io/npm/v/@appgeist/restful-api.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/@appgeist/restful-api
[license-image]: https://img.shields.io/npm/l/@appgeist/restful-api.svg?style=flat-square
[license-url]: LICENSE
