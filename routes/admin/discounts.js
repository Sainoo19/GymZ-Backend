const express = require('express');
const Discount = require('../../models/discounts'); // Assuming you have a Discount model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all discounts with pagination and filtering */
router.get('/all', async function (req, res, next) {
    try {
        const { page = 1, limit = 10, status, validFrom, validUntil } = req.query;

        const filters = {};

        if (status) {
            filters.status = status;
        }

        if (validFrom && validUntil) {
            filters.validFrom = { $gte: new Date(validFrom) };
            filters.validUntil = { $lte: new Date(validUntil) };
        }

        const discounts = await Discount.find(filters)
            .limit(parseInt(limit)) // Lấy giá trị limit từ query parameters hoặc đặt giá trị mặc định là 10
            .skip((parseInt(page) - 1) * parseInt(limit)) // Lấy giá trị page từ query parameters hoặc đặt giá trị mặc định là 1
            .exec();

        const count = await Discount.countDocuments(filters);

        res.successResponse({
            discounts
        }, 'Fetched all discounts successfully', 200, {
            totalDiscounts: count,
            pageSize: parseInt(limit),
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (err) {
        res.errorResponse('Failed to fetch discounts', 500, {}, { error: err.message });
    }
});

/* GET all discounts without pagination */
router.get('/all/nopagination', async function (req, res, next) {
    try {
        const discounts = await Discount.find();
        res.successResponse(discounts, 'Fetched all discounts successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch discounts', 500, {}, { error: err.message });
    }
});

/* POST create a new discount */
router.post('/create', async function (req, res, next) {
    try {
        const newDiscountId = await generateId('DIS');
        const newDiscount = new Discount({
            _id: newDiscountId,
            ...req.body
        });
        await newDiscount.save();
        res.successResponse(newDiscount, 'Discount created successfully');
    } catch (err) {
        res.errorResponse('Failed to create discount', 500, {}, { error: err.message });
    }
});

/* PUT update an existing discount */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedDiscount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedDiscount) {
            return res.errorResponse('Discount not found', 404);
        }
        res.successResponse(updatedDiscount, 'Discount updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update discount', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing discount */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedDiscount = await Discount.findByIdAndDelete(req.params.id);
        if (!deletedDiscount) {
            return res.errorResponse('Discount not found', 404);
        }
        res.successResponse(deletedDiscount, 'Discount deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete discount', 500, {}, { error: err.message });
    }
});

/* GET discount by id */
router.get('/:id', async function (req, res, next) {
    try {
        const discount = await Discount.findById(req.params.id);
        if (!discount) {
            return res.errorResponse('Discount not found', 404);
        }
        res.successResponse(discount, 'Fetched discount successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch discount', 500, {}, { error: err.message });
    }
});

module.exports = router;