const express = require('express');
const Order = require('../../models/orders'); // Assuming you have an Order model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all orders from database. */
router.get('/all', async function (req, res, next) {
    try {
        const orders = await Order.find();
        res.successResponse(orders, 'Fetched all orders successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch orders', 500, {}, { error: err.message });
    }
});

/* POST create a new order */
router.post('/create', async function (req, res, next) {
    try {
        const newOrderId = await generateId('ORD');
        const newOrder = new Order({
            _id: newOrderId,
            ...req.body
        });
        await newOrder.save();
        res.successResponse(newOrder, 'Order created successfully');
    } catch (err) {
        res.errorResponse('Failed to create order', 500, {}, { error: err.message });
    }
});

/* PUT update an existing order */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedOrder) {
            return res.errorResponse('Order not found', 404);
        }
        res.successResponse(updatedOrder, 'Order updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update order', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing order */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id);
        if (!deletedOrder) {
            return res.errorResponse('Order not found', 404);
        }
        res.successResponse(deletedOrder, 'Order deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete order', 500, {}, { error: err.message });
    }
});

/* GET order by id */
router.get('/:id', async function (req, res, next) {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.errorResponse('Order not found', 404);
        }
        res.successResponse(order, 'Fetched order successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch order', 500, {}, { error: err.message });
    }
});

module.exports = router;