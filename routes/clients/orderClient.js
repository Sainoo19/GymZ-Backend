
const express = require("express");
const mongoose = require("mongoose");
const Order = require("../../models/orders");
const User = require("../../models/users"); // Đảm bảo đường dẫn đúng
const generateId = require('../../utils/generateId');
const {authenticate} = require("../../middlewares/auth")
const Notification = require("../../models/Notification");
const Employee = require("../../models/employees");
const router = express.Router();

// API tạo đơn hàng
router.post("/create", authenticate, async (req, res) => {
  try {
    const { 
      user_id, 
      totalPrice, 
      status, 
      deliveryAddress,
      createdAt,
      updatedAt,
      items 
    } = req.body;

    // Kiểm tra thông tin bắt buộc
    if (!user_id || !totalPrice || !status || !deliveryAddress || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Thiếu thông tin đơn hàng hoặc danh sách sản phẩm không hợp lệ" });
    }

    // Kiểm tra các trường trong deliveryAddress
    const { provinceName, districtName, wardName, street, name, phone } = deliveryAddress;
    if (!provinceName || !districtName || !wardName || !street || !name || !phone) {
      return res.status(400).json({ message: "Thiếu thông tin địa chỉ giao hàng" });
    }

    // Tạo ID duy nhất cho đơn hàng
    const orderId = await generateId("ORD");

    // Tạo đơn hàng mới
    const newOrder = new Order({
      _id: orderId,
      user_id,
      totalPrice,
      status,
      deliveryPhoneNumber: phone,
      deliveryName: name,
      deliveryAdress: { province: provinceName, district: districtName, ward: wardName, street },
      items,
      createdAt: createdAt || Date.now(),
      updatedAt: updatedAt || Date.now(),
    });

    // Lưu vào database
    await newOrder.save();
   
    const employees = await Employee.find({ role: "admin" });
    console.log("🔎 Danh sách admin:", employees);
        for (const employee of employees) {
      console.log(`🔔 Thêm thông báo cho nhân viên ${employee._id}`);
    
      try {
        const newNotification = await Notification.create({
          employee_id: employee._id,
          title: "Đơn hàng mới",
          message: `Có đơn hàng mới với tổng giá trị ${totalPrice} VND`,
        });
    
        console.log("✅ Thêm thành công:", newNotification);
      } catch (error) {
        console.error("❌ Lỗi khi thêm notification:", error);
      }
    }
    
    console.log("Danh sách nhân viên admin:", employees);

    // 🔥 Gửi thông báo thời gian thực bằng Firebase Cloud Messaging (FCM)
    const employeeTokens = employees.map(e => e.fcmToken).filter(Boolean); // Lấy token FCM của nhân viên
    if (employeeTokens.length > 0) {
      const message = {
        notification: {
          title: "Đơn hàng mới!",
          body: `Có đơn hàng mới với tổng giá trị ${totalPrice} VND`
        },
        tokens: employeeTokens // Gửi đến tất cả nhân viên
      };

      admin.messaging().sendMulticast(message)
        .then(response => console.log("✅ Gửi thông báo FCM thành công:", response))
        .catch(error => console.error("❌ Lỗi khi gửi FCM:", error));
    }
    return res.status(201).json({ message: "Tạo đơn hàng thành công", order: newOrder });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi khi tạo đơn hàng", error: error.message });
  }
});

  
router.put("/update-status", async (req, res) => {
    const { orderId, status } = req.body;
  
    if (!orderId || !status) {
      return res.status(400).json({ message: "Thiếu thông tin orderId hoặc status!" });
    }
  
    try {
      const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
      }
  
      return res.json({ message: "Cập nhật trạng thái thành công!", order: updatedOrder });
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
      return res.status(500).json({ message: "Lỗi server khi cập nhật trạng thái đơn hàng." });
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
