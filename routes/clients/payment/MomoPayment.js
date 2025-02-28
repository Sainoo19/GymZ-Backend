const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const Payment = require('../../../models/payments'); // Cập nhật đường dẫn đúng

const router = express.Router();
var Ngrok_Url = "https://bbe1-14-186-220-9.ngrok-free.app";
var accessKey = "F8BBA842ECF85";
var secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

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
      await axios.post(`${process.env.BACKEND_URL}/payment/update-status`, {
        orderId,
        status: statuses[index],
      });
      index++;
    } else {
      clearInterval(interval);
    }
  }, 10000); // Cập nhật trạng thái mỗi 10 giây
};

// Gọi hàm này khi thanh toán thành công
router.get("/callback", async (req, res) => {
  const { resultCode, orderId } = req.query;

  if (resultCode === "0") {
    await Payment.findOneAndUpdate({ orderId }, { status: "Đơn hàng đã được tạo" });

    // Tự động cập nhật trạng thái đơn hàng theo thời gian thực
    updateOrderStatusAutomatically(orderId);

    // 🔹 Chuyển hướng về trang chủ thay vì trang order-progress
    return res.redirect(`http://localhost:3001/`);
  } else {
    return res.status(400).json({ message: "Thanh toán thất bại" });
  }
});






router.post("/transaction-status", async (req, res) => {
    const { orderId } = req.body;
  
    if (!orderId) {
      return res.status(400).json({ message: "Missing orderId" });
    }
  
    const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=MOMO&requestId=${orderId}`;
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");
  
    const requestBody = {
      partnerCode: "MOMO",
      requestId: orderId,
      orderId: orderId,
      signature: signature,
      lang: "vi",
    };
  
    const option = {
      method: "POST",
      url: "https://test-payment.momo.vn/v2/gateway/api/query",
      headers: {
        "Content-Type": "application/json",
      },
      data: requestBody,
    };
  
    try {
      let result = await axios(option);
      return res.status(200).json(result.data);
    } catch (error) {
      return res.status(500).json({
        message: "MoMo API error",
        error: error.response?.data || error.message,
      });
    }
  });
  
module.exports = router;
