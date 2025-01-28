const ResponseHandler = require('../middlewares/responseHandler');

const customResponse = (req, res, next) => {
    res.successResponse = (data = {}, message = 'Success', code = 200, metadata = {}) => {
        ResponseHandler.success(res, data, message, code, metadata);
    };

    res.errorResponse = (message = 'Error', code = 500, data = {}, metadata = {}) => {
        ResponseHandler.error(res, message, code, data, metadata);
    };

    next();
};

module.exports = customResponse;