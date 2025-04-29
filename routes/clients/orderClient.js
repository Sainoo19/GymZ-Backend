const express = require("express");
const mongoose = require("mongoose");
const Order = require("../../models/orders");
const Product = require("../../models/products");
const User = require("../../models/users"); // Đảm bảo đường dẫn đúng
const generateId = require("../../utils/generateId");
const { authenticate } = require("../../middlewares/auth");
//const Notification = require("../../models/notification");
const Employee = require("../../models/employees");
const router = express.Router();
const { db, admin } = require("../../config/firebase"); // Import Firestore
const formatCurrency = require("../../utils/formatCurrency"); // Import hàm formatCurrency

async function saveNotificationToFirestore(
  employeeId,
  title,
  message,
  orderId
) {
  try {
    await db.collection("notifications").add({
      employee_id: employeeId,
      orderId,
      title,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(), // Thời gian thực
    });
    console.log("Lưu thông báo vào Firestore thành công!");
  } catch (error) {
    console.error("Lỗi khi lưu thông báo vào Firestore:", error);
  }
}

// API tạo đơn hàng
router.post("/create", authenticate, async (req, res) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      user_id, totalPrice, status, deliveryAddress, createdAt, updatedAt, shippingFee, items
    } = req.body;

    // Kiểm tra thông tin bắt buộc...
    if (!user_id || !totalPrice || !status || !deliveryAddress || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Thiếu thông tin đơn hàng hoặc danh sách sản phẩm không hợp lệ");
    }

    // Kiểm tra các trường của deliveryAddress...
    const { provinceName, districtName, wardName, street, name, phone } = deliveryAddress;
    if (!provinceName || !districtName || !wardName || !street || !name || !phone) {
      throw new Error("Thiếu thông tin địa chỉ giao hàng");
    }

    // Tạo ID duy nhất cho đơn hàng
    const orderId = await generateId("ORD");

    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // Add 7 hours for UTC+7

    // Tạo đơn hàng mới
    const newOrder = new Order({
      _id: orderId,
      user_id,
      totalPrice,
      shippingFee,
      status,
      deliveryPhoneNumber: phone,
      deliveryName: name,
      deliveryAdress: {
        province: provinceName,
        district: districtName,
        ward: wardName,
        street,
      },
      items,
      createdAt: vietnamTime,
      updatedAt: vietnamTime,
    });

    // Lưu đơn hàng trong session
    await newOrder.save({ session });

    // Cập nhật kho: lặp qua từng sản phẩm trong đơn hàng
    for (const item of items) {
      const { product_id, category, theme, quantity } = item;
      const product = await Product.findOne({
        _id: product_id,
        "variations.category": category,
        ...(theme && { "variations.theme": theme }),
      }).session(session);

      if (!product) {
        throw new Error(`Không tìm thấy sản phẩm với ID: ${product_id}`);
      }

      const variation = product.variations.find(v => v.category === category && (!theme || v.theme === theme));
      if (!variation) {
        throw new Error(`Không tìm thấy biến thể phù hợp cho sản phẩm ${product.name}.`);
      }

      if (variation.stock < quantity) {
        throw new Error(`Sản phẩm ${product.name} không đủ hàng.`);
      }

      // Trừ số lượng kho
      variation.stock -= quantity;
      await product.save({ session });
    }

    // Gửi thông báo cho admin, cập nhật Firestore, v.v... (bạn cũng có thể thực hiện trong transaction nếu cần)
    const employees = await Employee.find({ role: "admin" }).session(session);
    for (const employee of employees) {
      await saveNotificationToFirestore(
        employee._id,
        "Đơn hàng mới",
        `Có đơn hàng mới trị giá ${formatCurrency(totalPrice)} VND`,
        orderId
      );
    }

    // Commit transaction nếu tất cả đều thành công
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ message: "Tạo đơn hàng thành công", order: newOrder });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ message: "Lỗi khi tạo đơn hàng", error: error.message });
  }
});

router.put("/update-status", async (req, res) => {
  const { orderId, status } = req.body;

  if (!orderId || !status) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin orderId hoặc status!" });
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

    return res.json({
      message: "Cập nhật trạng thái thành công!",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái đơn hàng:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi cập nhật trạng thái đơn hàng." });
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
    return res
      .status(500)
      .json({ message: "Lỗi khi hủy đơn hàng", error: error.message });
  }
});


// API lấy đơn hàng của người dùng với chi tiết sản phẩm
router.get("/orders", authenticate, async (req, res) => {
  try {
    const userId = req.user.id; // Lấy user_id từ middleware authenticate

    // Lấy đơn hàng từ database
    const orders = await Order.find({ user_id: userId })
      .sort({ createdAt: -1 }); // Sắp xếp theo thời gian tạo, mới nhất trước

    // Tạo một bản sao sâu của đơn hàng để xử lý
    const ordersWithProductDetails = JSON.parse(JSON.stringify(orders));

    // Lấy tất cả product_id từ tất cả đơn hàng
    const productIds = new Set();
    ordersWithProductDetails.forEach(order => {
      order.items.forEach(item => {
        productIds.add(item.product_id);
      });
    });

    // Lấy thông tin chi tiết của tất cả sản phẩm trong một lần truy vấn
    const products = await Product.find({ _id: { $in: Array.from(productIds) } },
      { _id: 1, name: 1, images: 1, avatar: 1 });

    // Tạo map để dễ dàng truy cập thông tin sản phẩm theo ID
    const productMap = {};
    products.forEach(product => {
      productMap[product._id] = {
        name: product.name,
        image: product.avatar || (product.images && product.images.length > 0 ? product.images[0] : "")
      };
    });

    // Thêm thông tin sản phẩm vào các item trong đơn hàng
    ordersWithProductDetails.forEach(order => {
      order.items.forEach(item => {
        if (productMap[item.product_id]) {
          item.productName = productMap[item.product_id].name;
          item.productImage = productMap[item.product_id].image;
        } else {
          item.productName = "Sản phẩm không tồn tại";
          item.productImage = "";
        }
      });
    });

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy lịch sử đặt hàng thành công",
      data: { orders: ordersWithProductDetails },
    });
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử đặt hàng:", error);
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi server khi lấy lịch sử đặt hàng",
      error: error.message,
    });
  }
});

module.exports = router;

