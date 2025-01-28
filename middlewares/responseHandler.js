class ResponseHandler {
    static success(res, data = {}, message = 'Success', code = 200, metadata = {}) {
        res.status(code).json({
            status: 'success',
            code: code,
            message: message,
            data: data,
            metadata: metadata,
        });
    }

    static error(res, message = 'Error', code = 500, data = {}, metadata = {}) {
        res.status(code).json({
            status: 'error',
            code: code,
            message: message,
            data: data,
            metadata: metadata,
        });
    }
}

module.exports = ResponseHandler;