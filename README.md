# @appgeist/restful-api

[![NPM version][npm-image]][npm-url]
[![License][license-image]][license-url]

An opinionated, [convention-over-configuration](https://en.wikipedia.org/wiki/Convention_over_configuration) Express-based restful API server featuring yup validation.

## Usage

### Initialization

You can use `@appgeist/restful-api` either as an [Express](https://expressjs.com) middleware:

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

Each module must export:

- `handler` - a mandatory function handler;
- `paramsSchema`, `querySchema`, `bodySchema` - optional schemas to validate the incoming request params, query and body. These can be simple objects (for brevity, in which case they will be converted to yup schemas automatically) or yup schemas (for more complex scenarios, i.e. when you need to specify a `.noUnknown()` modifier).

A function handler accepts an optional object parameter in the form of `{ params, query, body, req }` and must return the data that will be sent back to the client, or a Promise resolving with the data.

For simple cases when you don't care about validation, you can export just the handler, like so: `module.exports = () => {/* handle request here... */};`.

For nested paths like `routes/departments/[id]/employees/[id]/get.js`, **ancestor-level parameter names are _magically_ translated** and your handler `params` will be something like `{ departmentId, id }`.

### Validation errors

When request data validation fails, the client will receive a response with HTTP status code `400`/`BAD_REQUEST` and a JSON body describing the error provided by [`yup.validate(data, { abortEarly: false })`](https://github.com/jquense/yup#mixedvalidatevalue-any-options-object-promiseany-validationerror):

```json
{
  "message": "There were 2 validation errors",
  "errors": ["body.name is required", "body.description is required"]
}
```

### Throwing errors

If a function handler throws an `ApiError(httpStatusCode)` (also exported from this package), the client will receive a response with the specified HTTP status code and a JSON body like `{ "message": "Why it failed" }`.

The `ApiError` constructor accepts an HTTP status code number or an object structured like `{ status, message }`.

Using the constructor without parameters will result in a respose with HTTP status code `500` and the following JSON body:

```json
{
  "message": "Internal Server Error"
}
```

## Example

`routes/departments/get.js`:

```js
const Department = require("models/Department");

// simple handler, without validation
module.exports = () => Department.listAll();
// ...or exports.handler = () => Department.listAll();
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

exports.handler = async ({ params: { id }, body, req }) => {
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

exports.handler = async ({ params: { departmentId, id } }) => {
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
