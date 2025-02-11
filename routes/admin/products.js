const express = require('express');
const Product = require('../../models/products'); // Assuming you have a Product model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all products from database. */
// router.get('/all', async function (req, res, next) {
//     try {
//         const products = await Product.find();
//         res.successResponse(products, 'Fetched all products successfully');
//     } catch (err) {
//         res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
//     }
// });

/* GET all products from database with pagination */
router.get('/all', async function (req, res, next) {
    try {
        const { page = 1, limit = 12 } = req.query;

        const products = await Product.find()
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec();

        const count = await Product.countDocuments();

        res.status(200).json({
    success: true,
    message: "Fetched all products successfully",
    data: products,
    totalProducts: count,
    pageSize: parseInt(limit),
    currentPage: parseInt(page),
    totalPages: Math.ceil(count / parseInt(limit))
});

    } catch (err) {
        res.errorResponse('Failed to fetch products', 500, {}, { error: err.message });
    }
});


/* POST create a new product */
router.post('/create', async function (req, res, next) {
    try {
        const newProductId = await generateId('PR');
        const newProduct = new Product({
            _id: newProductId,
            ...req.body
        });
        await newProduct.save();
        res.successResponse(newProduct, 'Product created successfully');
    } catch (err) {
        res.errorResponse('Failed to create product', 500, {}, { error: err.message });
    }
});

/* PUT update an existing product */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProduct) {
            return res.errorResponse('Product not found', 404);
        }
        res.successResponse(updatedProduct, 'Product updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update product', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing product */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.errorResponse('Product not found', 404);
        }
        res.successResponse(deletedProduct, 'Product deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete product', 500, {}, { error: err.message });
    }
});

/* GET product by id */
router.get('/:id', async function (req, res, next) {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.errorResponse('Product not found', 404);
        }
        res.successResponse(product, 'Fetched product successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch product', 500, {}, { error: err.message });
    }
});

module.exports = router;