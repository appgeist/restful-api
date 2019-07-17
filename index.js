const express = require('express');

const buildRoutes = require('./lib/buildRoutes');
const errorHandler = require('./lib/errorHandler');

/**
 * Create a storage server Express-based instance
 *
 * @param {string} [routesDir] Folder where route definitions reside (relative to `cwd()`),
 *    defaults to `./routes`
 * @returns {import('express')} Express instance
 */
module.exports = exports = (routesDir = './routes') => {
  const app = express();
  app.use(express.json());
  buildRoutes({ app, routesDir });
  app.use(errorHandler);
  return app;
};

module.exports.ApiError = require('./lib/ApiError');
