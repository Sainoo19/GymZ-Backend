const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category_id: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true },
    images: { type: [String], required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    status: { type: String, required: true }
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;