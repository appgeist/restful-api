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

      const method = require(resolve(routesDir, file));

      let paramsSchema;
      let querySchema;
      let bodySchema;
      let beforeRequestHandler;
      let requestHandler;

      // initialize params, query, body schemas and before/on request handlers
      if (typeof method === 'function') {
        requestHandler = method;
      } else {
        ({
          paramsSchema,
          querySchema,
          bodySchema,
          beforeRequest: beforeRequestHandler,
          onRequest: requestHandler
        } = method);
        if (typeof requestHandler !== 'function') {
          // eslint-disable-next-line no-console
          console.log(red(`× Skipping invalid file ${file}; no request handler found...`));
          return;
        }
      }

      let schema;

      // build full schema
      if (paramsSchema || querySchema || bodySchema) {
        schema = object({
          params: paramsSchema ? (isSchema(paramsSchema) ? paramsSchema : object(paramsSchema)) : undefined,
          query: querySchema ? (isSchema(querySchema) ? querySchema : object(querySchema)) : undefined,
          body: bodySchema ? (isSchema(bodySchema) ? bodySchema : object(bodySchema)) : undefined
        });
      }

      const route = `/${dirname(file, '.js').replace(ROUTE_REGEXP, routeReplacer)}`;

      // log handling info in development mode
      if (IS_DEVELOPMENT) {
        let schemaInfo = '';
        if (schema) {
          const schemaInfoItems = [];
          if (paramsSchema) schemaInfoItems.push('paramsSchema');
          if (querySchema) schemaInfoItems.push('querySchema');
          if (bodySchema) schemaInfoItems.push('bodySchema');
          schemaInfo = ` (✓ ${toSentence(schemaInfoItems)})`;
        }

        const beforeRequestHandlerInfo = beforeRequestHandler ? ' (+ beforeRequest)' : '';

        // eslint-disable-next-line no-console
        console.log(green(`[API] ${verb.toUpperCase()} ${route} → ${file}${schemaInfo}${beforeRequestHandlerInfo}`));
      }

      // register the route verb handler
      app[verb](route, async (req, res, next) => {
        try {
          if (beforeRequestHandler) await beforeRequestHandler(req);

          const { params, query, body } = req;
          let data = { params, query, body };

          // validate and transform request data if a schema was defined
          if (schema) data = await schema.validate(data, { abortEarly: false });

          // execute method and send the response
          const result = await requestHandler({ ...data, req });
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
