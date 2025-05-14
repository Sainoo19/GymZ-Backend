const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Connect to the in-memory database before tests run
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

// Clear all data between tests
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});

// Disconnect and stop mongodb server after all tests finished
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Mock middleware functions
jest.mock('../middlewares/auth', () => ({
    authenticate: jest.fn((req, res, next) => next()),
    authorize: jest.fn((req, res, next) => next())
}));

// Mock custom response middleware
jest.mock('../utils/customResponse', () => (
    (req, res, next) => {
        res.successResponse = (data, message, status = 200, meta = {}) => {
            return res.status(status).json({
                status: 'success',
                message,
                data,
                meta
            });
        };
        res.errorResponse = (message, status = 500, meta = {}, errors = {}) => {
            return res.status(status).json({
                status: 'error',
                message,
                meta,
                errors
            });
        };
        next();
    }
));

// Mock generateId utility
jest.mock('../utils/generateId', () => jest.fn(() => 'PR1234567890'));