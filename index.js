const express = require('express');

const buildRoutes = require('./lib/buildRoutes');

/**
 * Create a restful API server Express-based instance
 *
 * @param {string} [routesDir] Folder where route definitions reside (relative to `cwd()`),
 *    defaults to `./routes`
 * @returns {import('express')} Express instance
 */
module.exports = exports = (routesDir = './routes') => {
  const app = express().use(express.json());
  buildRoutes({ app, routesDir });
  return app;
};

module.exports.ApiError = require('./lib/ApiError');
