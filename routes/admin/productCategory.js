const express = require('express');
const ProductCategory = require('../../models/productCategories'); // Assuming you have a ProductCategory model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all product categories with pagination and search */
router.get('/all', async function (req, res, next) {
    try {
        const { page = 1, limit = 10, search } = req.query;

        const filters = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Tạo biểu thức chính quy không phân biệt hoa thường
            filters.$or = [
                { _id: searchRegex }, // Tìm kiếm theo categoryID
                { name: searchRegex } // Tìm kiếm theo tên danh mục
            ];
        }

        const categories = await ProductCategory.find(filters)
            .limit(parseInt(limit)) // Lấy giá trị limit từ query parameters hoặc đặt giá trị mặc định là 10
            .skip((parseInt(page) - 1) * parseInt(limit)) // Lấy giá trị page từ query parameters hoặc đặt giá trị mặc định là 1
            .exec();

        const count = await ProductCategory.countDocuments(filters);

        res.successResponse({
            categories
        }, 'Fetched all product categories successfully', 200, {
            totalCategories: count,
            pageSize: parseInt(limit),
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (err) {
        res.errorResponse('Failed to fetch product categories', 500, {}, { error: err.message });
    }
});

/* GET all product categories from database without pagination */
router.get('/all/nopagination', async function (req, res, next) {
    try {
        const categories = await ProductCategory.find();
        res.successResponse(categories, 'Fetched all product categories successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch product categories', 500, {}, { error: err.message });
    }
});

/* POST create a new product category */
router.post('/create', async function (req, res, next) {
    try {
        const newCategoryId = await generateId('CAT');
        const newCategory = new ProductCategory({
            _id: newCategoryId,
            ...req.body
        });
        await newCategory.save();
        res.successResponse(newCategory, 'Product category created successfully');
    } catch (err) {
        res.errorResponse('Failed to create product category', 500, {}, { error: err.message });
    }
});

/* PUT update an existing product category */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedCategory = await ProductCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedCategory) {
            return res.errorResponse('Product category not found', 404);
        }
        res.successResponse(updatedCategory, 'Product category updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update product category', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing product category */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedCategory = await ProductCategory.findByIdAndDelete(req.params.id);
        if (!deletedCategory) {
            return res.errorResponse('Product category not found', 404);
        }
        res.successResponse(deletedCategory, 'Product category deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete product category', 500, {}, { error: err.message });
    }
});

/* GET product category by id */
router.get('/:id', async function (req, res, next) {
    try {
        const category = await ProductCategory.findById(req.params.id);
        if (!category) {
            return res.errorResponse('Product category not found', 404);
        }
        res.successResponse(category, 'Fetched product category successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch product category', 500, {}, { error: err.message });
    }
});

module.exports = router;