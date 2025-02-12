const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true }, // Loại hàng chính
    brand: { type: String, required: true }, // Tên thương hiệu
    variations: [
        {
            category: { type: String, required: true }, // Tên loại hàng con
            theme: { type: String, required: false }, // Màu sắc hoặc chủ đề
            stock: { type: Number, required: true }, // Số lượng tồn kho
            originalPrice: { type: Number, required: true }, // Giá gốc
            salePrice: { type: Number, required: true }, // Giá bán
        },
    ],
    images: { type: [String], required: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    status: { type: String, required: true, default: "active" },
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;