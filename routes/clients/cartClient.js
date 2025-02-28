const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Cart = require("../../models/cart");
const Product = require("../../models/products");
const { authenticate } = require("../../middlewares/auth");

// Thêm sản phẩm vào giỏ hàng
router.post("/add", authenticate, async (req, res) => {
    try {
        const { product_id, quantity, theme, category } = req.body;
        const userId = req.user.id;

        // Kiểm tra đầu vào hợp lệ
        if (!product_id || !quantity || isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({ message: "Dữ liệu đầu vào không hợp lệ" });
        }

        // Tìm sản phẩm theo ID
        const product = await Product.findById(product_id);
        if (!product) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }

        // Lọc biến thể phù hợp với category và theme
        const variation = product.variations.find(v => v.category === category && v.theme === theme);

        if (!variation) {
            return res.status(404).json({ message: "Không tìm thấy biến thể sản phẩm phù hợp" });
        }

        if (!variation.salePrice || isNaN(variation.salePrice)) {
            return res.status(400).json({ message: "Giá sản phẩm không hợp lệ" });
        }

        // Kiểm tra số lượng tồn kho
        if (variation.stock < quantity) {
            return res.status(400).json({ message: "Số lượng sản phẩm không đủ" });
        }

        // Tìm giỏ hàng của người dùng
        let cart = await Cart.findOne({ user_id: userId });
        if (!cart) {
            cart = new Cart({
                _id: new mongoose.Types.ObjectId().toString(),
                user_id: userId,
                totalPrice: 0,
                items: [],
            });
        }

        // Kiểm tra sản phẩm đã có trong giỏ chưa
        const existingItem = cart.items.find(item => 
            item.product_id === product_id && item.category === category && item.theme === theme
        );

        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cart.items.push({
                product_id,
                quantity,
                theme,
                category,
                price: variation.salePrice, // Lấy giá từ biến thể
            });
        }

        // Tính tổng giá
        cart.totalPrice = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cart.updatedAt = Date.now();

        await cart.save();
        res.status(200).json({ message: "Đã thêm vào giỏ hàng", cart });
    } catch (error) {
        console.error("Lỗi khi thêm vào giỏ hàng:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});


// Lấy toàn bộ sản phẩm trong giỏ hàng
router.get("/get", authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const cart = await Cart.findOne({ user_id: userId });

        if (!cart || cart.items.length === 0) {
            return res.status(200).json({ message: "Giỏ hàng trống", cart: { items: [] } });
        }

        // Lấy thông tin sản phẩm từ Product collection
        const populatedItems = await Promise.all(
            cart.items.map(async (item) => {
                const product = await Product.findById(item.product_id).select("name avatar");
                return {
                    ...item.toObject(),
                    productName: product?.name || "Không có tên",
                    productAvatar: product?.avatar || "",
                };
            })
        );

        res.status(200).json({ message: "Lấy giỏ hàng thành công", cart: { ...cart.toObject(), items: populatedItems } });
    } catch (error) {
        console.error("Lỗi khi lấy giỏ hàng:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
});



module.exports = router;
