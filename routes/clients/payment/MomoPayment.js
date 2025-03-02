const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const Payment = require('../../../models/payments'); // Cập nhật đường dẫn đúng

const router = express.Router();
var Ngrok_Url = "https://bbe1-14-186-220-9.ngrok-free.app";
var accessKey = "F8BBA842ECF85";
var secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
var URL_FRONTEND = process.env.URL_FRONTEND;
router.post("/momopayment", async (req, res) => {
  var { amount } = req.body; // Lấy số tiền từ request
  if (!amount) {
    return res.status(400).json({ message: "Thiếu số tiền thanh toán" });
  }

  var orderInfo = "Thanh toán MoMo";
  var partnerCode = "MOMO";
  var orderId = partnerCode + new Date().getTime();
  var redirectUrl = `${Ngrok_Url}/payment/callback?orderId=${orderId}`;
  var ipnUrl = `${Ngrok_Url}`;
  var requestType = "payWithMethod";
  var requestId = orderId;
  var extraData = "";

  var rawSignature =
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}` +
    `&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}` +
    `&requestType=${requestType}`;

  var signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");

  const requestBody = {
    partnerCode,
    partnerName: "Test",
    storeId: "MomoTestStore",
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang: "vi",
    requestType,
    autoCapture: true,
    extraData,
    orderGroupId: "",
    signature,
  };

  const option = {
    method: "POST",
    url: "https://test-payment.momo.vn/v2/gateway/api/create",
    headers: { "Content-Type": "application/json" },
    data: requestBody,
  };

  try {
    let result = await axios(option);
    console.log("orderId", orderId);
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi thanh toán MoMo", error: error.response?.data || error.message });
  }
});


const updateOrderStatusAutomatically = async (orderId) => {
  const statuses = [
    "Đơn hàng đã được tạo",
    "Nhân viên đang chuẩn bị hàng",
    "Đơn hàng đã giao cho đơn vị vận chuyển",
    "Đã nhận được hàng",
  ];

  let index = 0;
  const interval = setInterval(async () => {
    if (index < statuses.length) {
      await Payment.findOneAndUpdate(
        { orderId },
        { $push: { statusHistory: statuses[index] } }, // Thêm trạng thái vào lịch sử
        { new: true }
      );
      index++;
    } else {
      clearInterval(interval);
    }
  }, 10000); // Cập nhật trạng thái mỗi 10 giây
};

router.get("/callback", async (req, res) => {
  const { resultCode, orderId } = req.query;

  if (resultCode === "0") {
    await Payment.findOneAndUpdate({ orderId }, { status: "Đơn hàng đã được tạo" });

    // Tự động cập nhật trạng thái đơn hàng
    updateOrderStatusAutomatically(orderId);

    // 🔹 Chuyển hướng đến trang OrderProgressPage với orderId
    return res.redirect(`${URL_FRONTEND}/order-progress?orderId=${orderId}`);
  } else {
    return res.status(400).json({ message: "Thanh toán thất bại" });
  }
});



router.post("/transaction-status", async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Thiếu orderId" });
  }

  try {
    const order = await Payment.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    return res.status(200).json({ statusHistory: order.statusHistory || [] });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi lấy trạng thái đơn hàng", error: error.message });
  }
});
module.exports = router;
