const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const cartItemSchema = new Schema({
    product_id: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
});

const cartSchema = new Schema({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    items: [cartItemSchema]
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;