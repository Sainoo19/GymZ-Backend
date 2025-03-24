const express = require("express");
const router = express.Router();
const Order = require("../../models/orders"); // Import model đơn hàng
const { emitNewOrder } = require("../../socket/socketIO"); // Import socket

// API tạo đơn hàng
router.post("/", async (req, res) => {
  try {
    const newOrder = new Order(req.body);
    const savedOrder = await newOrder.save();

    // Gửi thông báo đơn hàng mới qua socket
    emitNewOrder({
      id: savedOrder._id,
      customer: savedOrder.customerName,
      total: savedOrder.totalPrice,
      createdAt: savedOrder.createdAt
    });

    res.status(201).json({ success: true, data: savedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi tạo đơn hàng", error });
  }
});

module.exports = router;
