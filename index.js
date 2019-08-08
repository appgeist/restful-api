const express = require('express');

const buildRoutes = require('./lib/buildRoutes');

/**
 * Create a restful API server Express-based instance
 *
 * @param {string} [routesDir] Folder where route definitions reside (relative to `cwd()`),
 *    defaults to `./routes`
 * @returns {import('express')} Express instance
 * @param {Options} [options] Custom options
 * @returns {import('express')} Express instance
 */
module.exports = exports = (routesDir = './routes', { errorHandler = require('./lib/errorHandler') }) => {
  const app = express();
  app.use(express.json());
  buildRoutes({ app, routesDir });
  app.use(errorHandler);
  return app;
};

/**
 * @typedef {Object} Options
 * @property {ErrorHandlerFunction} errorHandler Custom error handler function
 */

/**
 * @callback ErrorHandlerFunction
 * @param {ErrorHandlerFunctionParameters} options Error handler function parameters
 */

/**
 * @typedef {Object} ErrorHandlerFunctionParameters
 * @property {Object} err Error
 * @property {Object} res Response object
 */

module.exports.ApiError = require('./lib/ApiError');
