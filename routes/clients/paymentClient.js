const express = require("express");
const router = express.Router();
const Payment = require("../../models/payments");
const Order = require("../../models/orders");
const mongoose = require("mongoose");
const generateId = require("../../utils/generateId");

router.post("/create", async (req, res) => {
  const { orderId, paymentMethod } = req.body;
  console.log("orderId received:", orderId);

  if (!orderId) {
    return res.status(400).json({ message: "Thiếu thông tin orderId!" });
  }

  try {
    // Kiểm tra xem payment đã tồn tại chưa
    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
      return res.json({ message: "Payment đã tồn tại!", payment: existingPayment });
    }

    // Lấy thông tin đơn hàng
    const order = await Order.findById(orderId);
    console.log("Order found:", order);

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
    }
    const newPaymentId = await generateId('PA');

    // Tạo payment mới
    const newPayment = new Payment({
      _id: newPaymentId,
      orderId,
      user_id: order.user_id,
      amount: order.totalPrice,
      paymentMethod: paymentMethod,
      status: "Đang xử lý",
    });

    await newPayment.save();
    return res.json({ message: "Payment đã được tạo thành công!", payment: newPayment });
  } catch (error) {
    console.error("Lỗi tạo payment:", error);
    return res.status(500).json({ message: "Lỗi server khi tạo payment.", error: error.message });
  }
});


router.get("/find", async (req, res) => {
  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).json({ message: "Thiếu thông tin orderId!" });
  }

  try {
    const payment = await Payment.findOne({ orderId });

    if (!payment) {
      return res.status(404).json({ message: "Không tìm thấy payment!" });
    }

    return res.json({ message: "Tìm thấy payment!", payment });
  } catch (error) {
    console.error("Lỗi tìm payment:", error);
    return res.status(500).json({ message: "Lỗi server khi tìm payment." });
  }
});

module.exports = router;
