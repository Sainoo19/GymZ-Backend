
const express = require("express");
const mongoose = require("mongoose");
const Order = require("../../models/orders");
const User = require("../../models/users"); // Đảm bảo đường dẫn đúng

const {authenticate} = require("../../middlewares/auth")

const router = express.Router();

// API tạo đơn hàng
router.post("/create", authenticate, async (req, res) => {
    try {
        const { user_id, totalPrice, status, deliveryAdress, deliveryPhoneNumber, items } = req.body;

        // Kiểm tra đầu vào
        if (!user_id || !totalPrice || !status || !deliveryAdress || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Thiếu thông tin đơn hàng hoặc danh sách sản phẩm không hợp lệ" });
        }

        // 📌 Lấy thông tin user từ database
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ message: "Người dùng không tồn tại" });
        }

        // Tạo ID duy nhất cho đơn hàng
        const orderId = new mongoose.Types.ObjectId().toString();

        const newOrder = new Order({
            _id: orderId,
            user_id,
            totalPrice,
            status,
            deliveryPhoneNumber: user.phone, // ✅ Lấy từ user
            deliveryAdress,
            items,
        });

        // Lưu vào database
        await newOrder.save();

        return res.status(201).json({ message: "Tạo đơn hàng thành công", order: newOrder });
    } catch (error) {
        return res.status(500).json({ message: "Lỗi khi tạo đơn hàng", error: error.message });
    }
});

router.put("/cancel/:orderId", authenticate, async (req, res) => {
    try {
        const { orderId } = req.params;

        // Kiểm tra đơn hàng có tồn tại không
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
        }

        // Kiểm tra trạng thái đơn hàng, nếu đã thanh toán thì không hủy
        if (order.status !== "Chờ xác nhận") {
            return res.status(400).json({ message: "Đơn hàng không thể bị hủy" });
        }

        // Cập nhật trạng thái đơn hàng thành "Đã hủy"
        order.status = "Đã hủy";
        await order.save();

        return res.status(200).json({ message: "Đơn hàng đã bị hủy", order });
    } catch (error) {
        return res.status(500).json({ message: "Lỗi khi hủy đơn hàng", error: error.message });
    }
});
module.exports = router;
