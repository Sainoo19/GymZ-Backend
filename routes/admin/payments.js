const express = require('express');
const Payment = require('../../models/payments'); // Assuming you have a Payment model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all payments from database. */
router.get('/all', async function (req, res, next) {
    try {
        const { page = 1, limit = 10, status, paymentMethod, startDate, endDate, search } = req.query;

        const filters = {};

        if (status) {
            filters.status = status;
        }

        if (paymentMethod) {
            filters.paymentMethod = paymentMethod;
        }

        if (startDate && endDate) {
            filters.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i'); // Tạo biểu thức chính quy không phân biệt hoa thường
            filters.$or = [
                { _id: searchRegex }, // Tìm kiếm theo paymentID
                { orderId: searchRegex }, // Tìm kiếm theo orderID
                { user_id: searchRegex } // Tìm kiếm theo userID
            ];
        }

        const payments = await Payment.find(filters)
            .limit(parseInt(limit)) // Lấy giá trị limit từ query parameters hoặc đặt giá trị mặc định là 10
            .skip((parseInt(page) - 1) * parseInt(limit)) // Lấy giá trị page từ query parameters hoặc đặt giá trị mặc định là 1
            .exec();

        const count = await Payment.countDocuments(filters);

        res.successResponse({
            payments
        }, 'Fetched all payments successfully', 200, {
            totalPayments: count,
            pageSize: parseInt(limit),
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (err) {
        res.errorResponse('Failed to fetch payments', 500, {}, { error: err.message });
    }
});

/* POST create a new payment */
router.post('/create', async function (req, res, next) {
    try {
        const newPaymentId = await generateId('PAY');
        const newPayment = new Payment({
            _id: newPaymentId,
            ...req.body
        });
        await newPayment.save();
        res.successResponse(newPayment, 'Payment created successfully');
    } catch (err) {
        res.errorResponse('Failed to create payment', 500, {}, { error: err.message });
    }
});

/* PUT update an existing payment */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedPayment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPayment) {
            return res.errorResponse('Payment not found', 404);
        }
        res.successResponse(updatedPayment, 'Payment updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update payment', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing payment */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedPayment = await Payment.findByIdAndDelete(req.params.id);
        if (!deletedPayment) {
            return res.errorResponse('Payment not found', 404);
        }
        res.successResponse(deletedPayment, 'Payment deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete payment', 500, {}, { error: err.message });
    }
});

/* GET payment by id */
router.get('/:id', async function (req, res, next) {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.errorResponse('Payment not found', 404);
        }
        res.successResponse(payment, 'Fetched payment successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch payment', 500, {}, { error: err.message });
    }
});

module.exports = router;