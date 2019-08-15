const { ValidationError } = require('yup');
const { BAD_REQUEST, INTERNAL_SERVER_ERROR, getStatusText } = require('http-status-codes');
const ApiError = require('./ApiError');

module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ValidationError) {
    const { message, errors } = err;
    res.status(BAD_REQUEST).send({ message, errors });
  } else if (err instanceof ApiError) {
    res.status(err.status).send({ message: err.message });
  } else {
    // eslint-disable-next-line no-console
    console.log(err.stack);
    res.status(INTERNAL_SERVER_ERROR).send({ message: getStatusText(INTERNAL_SERVER_ERROR) });
  }
};
