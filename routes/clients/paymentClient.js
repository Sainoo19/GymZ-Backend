const express = require("express");
const router = express.Router();
const Payment = require("../../models/payments");
const Order = require("../../models/orders");
const User = require("../../models/users");
const { sendOrderConfirmationEmail } = require("../../utils/emailService");
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
    console.log("ship", order.shippingFee);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
    }
    const newPaymentId = await generateId('PA');
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // Add 7 hours for UTC+7

    // Xác định trạng thái thanh toán dựa vào phương thức thanh toán
    let paymentStatus = "Đang xử lý"; // Mặc định cho COD
    if (paymentMethod === "MoMo") {
      paymentStatus = "Đã thanh toán";
    }

    // Tạo payment mới với trạng thái phù hợp
    const newPayment = new Payment({
      _id: newPaymentId,
      orderId,
      user_id: order.user_id,
      amount: order.totalPrice + order.shippingFee,
      paymentMethod: paymentMethod,
      status: paymentStatus,
      createdAt: vietnamTime,
      updatedAt: vietnamTime
    });

    await newPayment.save();

    // Gửi email xác nhận thanh toán
    try {
      // Tìm order với đầy đủ thông tin chi tiết sản phẩm
      const orderWithDetails = await Order.findById(orderId);

      if (orderWithDetails) {
        // Thêm thông tin chi tiết sản phẩm (tên, hình ảnh, giá) vào order 
        const orderWithProductDetails = JSON.parse(JSON.stringify(orderWithDetails));

        // Lấy tất cả product_id từ đơn hàng
        const productIds = new Set();
        orderWithProductDetails.items.forEach(item => productIds.add(item.product_id));

        // Lấy thông tin chi tiết các sản phẩm
        const products = await Product.find(
          { _id: { $in: Array.from(productIds) } },
          { _id: 1, name: 1, images: 1, avatar: 1, variations: 1 }
        );

        // Tạo map để dễ truy cập
        const productMap = {};
        products.forEach(product => {
          productMap[product._id] = {
            name: product.name,
            image: product.avatar || (product.images && product.images.length > 0 ? product.images[0] : ""),
            variations: product.variations
          };
        });

        // Thêm thông tin chi tiết vào items
        orderWithProductDetails.items.forEach(item => {
          if (productMap[item.product_id]) {
            item.productName = productMap[item.product_id].name;
            item.productImage = productMap[item.product_id].image;

            const variations = productMap[item.product_id].variations;
            if (variations && variations.length > 0) {
              const variation = variations.find(v =>
                v.category === item.category &&
                (!item.theme || v.theme === item.theme)
              );

              if (variation) {
                item.price = variation.salePrice;
                item.originalPrice = variation.originalPrice;
              }
            }
          } else {
            item.productName = "Sản phẩm không tồn tại";
            item.productImage = "";
          }
        });

        // Lấy email người dùng
        const user = await User.findById(order.user_id);
        if (user && user.email) {
          await sendOrderConfirmationEmail(user.email, orderWithProductDetails, newPayment);
          console.log("Đã gửi email xác nhận thanh toán thành công!");
        }
      }
    } catch (emailError) {
      console.error("Lỗi khi gửi email xác nhận thanh toán:", emailError);
      // Không throw lỗi ở đây để đảm bảo API vẫn trả về thành công
    }

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

router.get("/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: "Không tìm thấy payment!" });
    }
    return res.status(200).json({ message: "Tìm thấy payment!", payment });
  } catch (error) {
    console.error("Lỗi khi lấy payment:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi lấy payment", error: error.message });
  }
});

module.exports = router;
