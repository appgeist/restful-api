const { dirname, basename, resolve } = require('path');
const readdirRecursive = require('fs-readdir-recursive');
const { singular } = require('pluralize');
const upperFirst = require('lodash/upperFirst');
const toSentence = require('underscore.string/toSentence');
const { green, red } = require('chalk');
const { object, isSchema } = require('yup');
const { CREATED, NO_CONTENT } = require('http-status-codes');

const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

const VALID_VERBS = ['get', 'post', 'put', 'patch', 'delete'];

// magic to turn strings like 'categories/[id]/makes/[id]' into 'categories/:categoryId/makes/:id'
const ROUTE_REGEXP = /(\w+)\/\[(\w+)\](\/?)/g;
const routeReplacer = (_, parent, id, slash) => `${parent}/:${slash ? singular(parent) + upperFirst(id) : id}${slash}`;

module.exports = ({ app, routesDir }) => {
  readdirRecursive(routesDir)
    .filter(file => file !== 'index.js')
    .sort()
    .reverse() // to process /list before /[id]
    .forEach((file) => {
      const verb = basename(file, '.js');

      // make sure method name is one of VALID_METHOD_NAMES
      if (!VALID_VERBS.includes(verb)) {
        // eslint-disable-next-line no-console
        console.log(
          red(
            `× Skipping invalid file ${file}; name must be one of ${toSentence(
              VALID_VERBS.map(n => `${n}.js`),
              ', ',
              ' or '
            )}...`
          )
        );
        return;
      }

      const mod = require(resolve(routesDir, file));

      let paramsSchema;
      let querySchema;
      let bodySchema;
      let handler;

      // initialize params, query and body schemas and handler
      if (typeof mod === 'function') {
        handler = mod;
      } else {
        ({ paramsSchema, querySchema, bodySchema, handler } = mod);
        if (typeof handler !== 'function') {
          // eslint-disable-next-line no-console
          console.log(red(`× Skipping invalid file ${file}; no request handler found...`));
          return;
        }
      }

      let schema;

      // build full schema
      if (paramsSchema || querySchema || bodySchema) {
        schema = object({
          params: isSchema(paramsSchema) ? paramsSchema : object(paramsSchema),
          query: isSchema(querySchema) ? querySchema : object(querySchema),
          body: isSchema(bodySchema) ? bodySchema : object(bodySchema)
        });
      }

      const route = `/${dirname(file, '.js').replace(ROUTE_REGEXP, routeReplacer)}`;

      // log handling info in development mode
      if (IS_DEVELOPMENT) {
        let schemaInfo = '';
        if (schema) {
          const schemaInfoItems = [];
          if (paramsSchema) schemaInfoItems.push('params');
          if (querySchema) schemaInfoItems.push('query');
          if (bodySchema) schemaInfoItems.push('body');
          schemaInfo = ` (✓ ${toSentence(schemaInfoItems)})`;
        }
        // eslint-disable-next-line no-console
        console.log(green(`[API] ${verb.toUpperCase()} ${route} → ${file}${schemaInfo}`));
      }

      // register the route verb handler
      app[verb](route, async (req, res, next) => {
        try {
          const { params, query, body } = req;
          let data = { params, query, body };

          // validate and transform request data if a schema was defined
          if (schema) data = await schema.validate(data, { abortEarly: false });

          // execute method and send the response
          const result = await handler({ ...data, req });
          if (result === undefined || result === null) {
            res.sendStatus(verb === 'post' ? CREATED : NO_CONTENT);
          } else {
            res.json(result);
          }
        } catch (err) {
          next(err);
        }
      });
    });
};
