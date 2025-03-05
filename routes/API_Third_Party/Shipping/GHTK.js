const express = require("express");
const axios = require("axios");
const router = express.Router();
const GHTK_URL = process.env.GHTK_URL;
  const GHTK_TOKEN = process.env.GHTK_TOKEN;
  const GHTK_PARTNER_CODE = process.env.GHTK_PARTNER_CODE;

  router.get("/shipping-fee", async (req, res) => {
    try {
      const { pick_province, pick_district, province, district, weight, deliver_option, pick_address_id } = req.query;
  
      // Kiểm tra tham số bắt buộc
      if ((!pick_address_id && (!pick_province || !pick_district)) || !province || !district || !weight || !deliver_option) {
        return res.status(400).json({
          message: "Thiếu tham số bắt buộc!",
        });
      }
  
      // Gọi API GHTK
      const response = await axios.get(`${GHTK_URL}/services/shipment/fee`, {
        headers: {
          "Token": GHTK_TOKEN,
          "X-Client-Source": GHTK_PARTNER_CODE,
        },
        params: req.query,
      });
  
      return res.json(response.data); // Trả về dữ liệu từ GHTK
    } catch (error) {
      console.error("❌ Lỗi khi tính phí vận chuyển:", error.response?.data || error.message);
      
      return res.status(error.response?.status || 500).json({
        message: "Lỗi khi lấy phí vận chuyển",
        error: error.response?.data || error.message,
      });
    }
  });
  

module.exports = router;

