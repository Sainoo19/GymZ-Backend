const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../../models/orders"); // Cập nhật đường dẫn đúng
const { authenticate } = require("../../../middlewares/auth");
const { db, admin } = require("../../../config/firebase"); // Import Firestore
const Payment = require("../../../models/payments");
const Employee = require("../../../models/employees");

const router = express.Router();
var Ngrok_Url = process.env.NGROK_URL;
var accessKey = process.env.ACCESS_MOMO_KEY;
var secretKey = process.env.SECRET_MOMO_KEY;
var URL_FRONTEND = process.env.URL_FRONTEND;

async function saveUserNotificationToFirestore(employee_id, title, message, PaymentId) {
  try {
    await db.collection("notifications").add({
      employee_id,
      PaymentId,
      title,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: "payment",
    });
  } catch (error) {
    console.error("Lỗi ghi thông báo Firestore:", error);
  }
}


router.post("/momopayment", authenticate, async (req, res) => {
  var { amount, orderId, selectedMethod } = req.body; // Lấy số tiền từ request
  if (!amount) {
    return res.status(400).json({ message: "Thiếu số tiền thanh toán" });
  }
  if (!orderId) {
    return res.status(400).json({ message: "Thiếu Id Order thanh toán" });
  }
  
  var user_id = req.user?.id;
  if (!user_id) {
    return res.status(400).json({ message: "Không tìm thấy user_id" });
  }
  var orderInfo = "Thanh toán MoMo";
  var partnerCode = "MOMO";
  var redirectUrl = `${Ngrok_Url}/payment/callback?orderId=${orderId}selectedMethod=${selectedMethod}`;
  var ipnUrl = `${Ngrok_Url}`;
  var requestType = "payWithMethod";
  var requestId = orderId;
  var extraData = user_id;
  var rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  var signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");
  console.log("rawSignature", rawSignature);
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
    console.log("Kết quả từ MoMo:", result.data);

    // Kiểm tra nếu MoMo trả về lỗi
    if (result.data.resultCode !== 0) {
      return res.status(500).json({
        message: "Lỗi từ MoMo",
        error: result.data.message || "Giao dịch không thành công",
      });
    }

    // Nếu thành công, trả về `payUrl`
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({

      error: error.response?.data || error.message,
    });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const { resultCode, orderId, selectedMethod } = req.query;

    // Nếu orderId là mảng, lấy phần tử đầu tiên
    let finalOrderId = Array.isArray(orderId) ? orderId[0] : orderId;
    let createdPayment = null;

    if (resultCode === "0") {

      try {
        await axios.post(`${URL_API}paymentClient/create`, {
          orderId: finalOrderId,
          paymentMethod: selectedMethod ,
        });
        createdPayment = response.data.payment;

        console.log("Đã gọi API tạo payment từ callback");
      } catch (error) {
        console.error("Lỗi gọi API tạo payment:", error?.response?.data || error.message);
        return res.redirect(`${URL_FRONTEND}/payment-error`);
      }

      // 🔍 Lấy đơn hàng từ DB để lấy user_id
          const employees = await Employee.find({ role: "admin" });
      
          for (const employee of employees) {
            await saveUserNotificationToFirestore(
              employee._id,
              "Khách hàng đã thanh toán",
              `Khách hàng đã thanh toán đơn hàng ${finalOrderId} với mã hoá đơn ${createdPayment?._id}`,  
              createdPayment?._id
            );
          }
    
      return res.redirect(`${URL_FRONTEND}/order-progress?orderId=${finalOrderId}&paymentMethod=MoMo`);
    }
    
  } catch (error) {
    console.error("Lỗi xử lý callback thanh toán:", error);
    return res.redirect(`${URL_FRONTEND}/payment-error`);
  }
});


router.post("/transaction-status", async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Thiếu orderId" });
  }

  try {
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    return res.status(200).json({ statusHistory: order.statusHistory || [] });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Lỗi lấy trạng thái đơn hàng", error: error.message });
  }
});
module.exports = router;
