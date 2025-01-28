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
        const payments = await Payment.find();
        res.successResponse(payments, 'Fetched all payments successfully');
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