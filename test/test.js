const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/products');
const ProductCategory = require('../models/productCategories');
const productRoutes = require('../routes/admin/products');
const { mockProductData, mockCategoryData } = require('./mockdata');

// Create express app for testing
const app = express();
app.use(express.json());

// Mock middleware functions
jest.mock('../middlewares/auth', () => ({
    authenticate: jest.fn((req, res, next) => next()),
    authorize: jest.fn((req, res, next) => next())
}));

// Mock custom response middleware
app.use((req, res, next) => {
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
});

// Mock generateId utility
jest.mock('../utils/generateId', () => jest.fn(() => 'PR1234567890'));

// Use product routes
app.use('/', productRoutes);

// Connect to in-memory MongoDB before tests
let mongoServer;
beforeAll(async () => {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

// Clear all data between tests
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
});

// Disconnect and stop MongoDB server after all tests
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Products API Routes', () => {
    beforeEach(async () => {
        // Seed the database with test data before each test
        await ProductCategory.create(mockCategoryData);
        await Product.create(mockProductData);
    });

    describe('GET /all/nopagination', () => {
        it('should return all products', async () => {
            const res = await request(app).get('/all/nopagination');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0]._id).toBe(mockProductData._id);
        });

        it('should handle errors', async () => {
            // Mock Product.find to throw an error
            jest.spyOn(Product, 'find').mockImplementationOnce(() => {
                throw new Error('Database error');
            });

            const res = await request(app).get('/all/nopagination');

            expect(res.status).toBe(500);
            expect(res.body.status).toBe('error');
        });
    });

    describe('GET /all/cardpage', () => {
        // it('should return paginated products with default params', async () => {
        //     const res = await request(app).get('/all/cardpage');

        //     expect(res.status).toBe(200);
        //     expect(res.body.status).toBe('success');
        //     expect(res.body.data).toHaveProperty('products');
        //     expect(res.body.meta).toHaveProperty('totalProducts');
        //     expect(res.body.meta).toHaveProperty('pageSize');
        //     expect(res.body.meta.pageSize).toBe(10);
        // });

        it('should filter products by category', async () => {
            const res = await request(app)
                .get(`/all/cardpage?category=${mockProductData.category}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.products).toBeInstanceOf(Array);
        });

        it('should filter products by price range', async () => {
            const res = await request(app)
                .get('/all/cardpage?priceMin=50000&priceMax=150000');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
        });


    });

    describe('GET /minmaxprice/:productId', () => {
        it('should return min/max price for a product', async () => {
            const res = await request(app).get(`/minmaxprice/${mockProductData._id}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('minPrice');
            expect(res.body).toHaveProperty('maxPrice');
            expect(res.body.minPrice).toBe(100000);
            expect(res.body.maxPrice).toBe(120000);
        });

        // it('should return 404 for non-existent product', async () => {
        //     const res = await request(app).get('/minmaxprice/PR9999');

        //     expect(res.status).toBe(404);
        //     // Test specifically against your API's error structure
        //     expect(res.body.status).toBe('error');
        // });
    });

    describe('GET /minmaxprice', () => {
        it('should return min/max prices for all products', async () => {
            const res = await request(app).get('/minmaxprice');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data[0]).toHaveProperty('minSalePrice');
            expect(res.body.data[0]).toHaveProperty('maxSalePrice');
        });
    });

    describe('GET /stock/:productId', () => {
        it('should return total stock for a product', async () => {
            const res = await request(app).get(`/stock/${mockProductData._id}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('totalStock');
            expect(res.body.totalStock).toBe(15); // 10 + 5 from our mock data
        });

        it('should return 404 for non-existent product', async () => {
            const res = await request(app).get('/stock/PR9999');

            expect(res.status).toBe(404);
        });
    });

    describe('POST /create', () => {
        it('should create a new product', async () => {
            const newProduct = {
                name: 'New Test Product',
                description: 'New product description',
                category: 'CAT001', // Use existing category ID
                brand: 'New Brand',
                variations: [
                    {
                        category: 'Protein',
                        theme: 'Green',
                        stock: 20,
                        salePrice: 80000,
                        originalPrice: 100000,
                        weight: 0.5
                    }
                ],
                avatar: 'new-image.jpg',
                images: ['new-image1.jpg', 'new-image2.jpg']
            };

            const res = await request(app)
                .post('/create')
                .send(newProduct);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data).toHaveProperty('_id');
            expect(res.body.data.name).toBe(newProduct.name);

            // Verify the product was saved in the database
            const savedProduct = await Product.findById(res.body.data._id);
            expect(savedProduct).not.toBeNull();
            expect(savedProduct.name).toBe(newProduct.name);
        });
    });

    describe('PUT /update/:id', () => {
        it('should update an existing product', async () => {
            const updatedData = {
                name: 'Updated Product Name'
            };

            const res = await request(app)
                .put(`/update/${mockProductData._id}`)
                .send(updatedData);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.name).toBe(updatedData.name);

            // Verify the product was updated in the database
            const updatedProduct = await Product.findById(mockProductData._id);
            expect(updatedProduct.name).toBe(updatedData.name);
        });

        it('should return 404 for non-existent product', async () => {
            const res = await request(app)
                .put('/update/PR9999')
                .send({ name: 'Updated Name' });

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /delete/:id', () => {
        it('should delete an existing product', async () => {
            const res = await request(app).delete(`/delete/${mockProductData._id}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');

            // Verify the product was deleted from the database
            const deletedProduct = await Product.findById(mockProductData._id);
            expect(deletedProduct).toBeNull();
        });

        it('should return 404 for non-existent product', async () => {
            const res = await request(app).delete('/delete/PR9999');

            expect(res.status).toBe(404);
        });
    });

    describe('GET /:id', () => {
        it('should get a product by id', async () => {
            const res = await request(app).get(`/${mockProductData._id}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data._id).toBe(mockProductData._id);
        });

        it('should return 404 for non-existent product', async () => {
            const res = await request(app).get('/PR9999');

            expect(res.status).toBe(404);
        });
    });

    describe('PUT /update-stock/:productId', () => {
        it('should update product variation stock', async () => {
            const variations = mockProductData.variations.map(v => ({
                _id: v._id.toString(),
                additionalStock: 5
            }));

            const res = await request(app)
                .put(`/update-stock/${mockProductData._id}`)
                .send({ variations });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Cập nhật stock thành công');

            // Verify the stock was updated in the database
            const updatedProduct = await Product.findById(mockProductData._id);
            expect(updatedProduct.variations[0].stock).toBe(15); // 10 + 5
            expect(updatedProduct.variations[1].stock).toBe(10); // 5 + 5
        });

        it('should return 404 for non-existent product', async () => {
            const res = await request(app)
                .put('/update-stock/PR9999')
                .send({ variations: [] });

            expect(res.status).toBe(404);
        });

        it('should return 400 for invalid variations data', async () => {
            const res = await request(app)
                .put(`/update-stock/${mockProductData._id}`)
                .send({ variations: "not an array" });

            expect(res.status).toBe(400);
        });
    });
});