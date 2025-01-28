const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
    product_id: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
});

const orderSchema = new Schema({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    items: [orderItemSchema]
});

module.exports = mongoose.model('Order', orderSchema);