const express = require("express");
const axios = require("axios");
const router = express.Router();
const GHTK_URL = process.env.GHTK_URL;
const GHTK_TOKEN = process.env.GHTK_TOKEN;
const GHTK_PARTNER_CODE = process.env.GHTK_PARTNER_CODE;
const Product = require("../../../models/products"); // Giả sử bạn có model Product trong MongoDB

router.get("/shipping-fee", async (req, res) => {
  try {
    const {
      pick_province,
      pick_district,
      pick_ward,
      weight,
      deliver_option,
      pick_address_id,
      province,
      district,
      ward,
      street,
    } = req.query;

    // Kiểm tra tham số bắt buộc
    if (
      (!pick_address_id && (!pick_province || !pick_district)) ||
      !province ||
      !district ||
      !weight ||
      !deliver_option
    ) {
      return res.status(400).json({
        message: "Thiếu tham số bắt buộc!",
      });
    }

    // Gọi API GHTK
    const response = await axios.get(`${GHTK_URL}/services/shipment/fee`, {
      headers: {
        Token: GHTK_TOKEN,
        "X-Client-Source": GHTK_PARTNER_CODE,
      },
      params: req.query,
    });

    return res.json(response.data); // Trả về dữ liệu từ GHTK
  } catch (error) {
    console.error(
      "❌ Lỗi khi tính phí vận chuyển:",
      error.response?.data || error.message
    );

    return res.status(error.response?.status || 500).json({
      message: "Lỗi khi lấy phí vận chuyển",
      error: error.response?.data || error.message,
    });
  }
});

// API tính tổng khối lượng dựa vào category và theme
router.post("/get-total-weight", async (req, res) => {
  try {
    const { selectedItems } = req.body;

    if (!selectedItems || selectedItems.length === 0) {
      return res.status(400).json({ message: "Danh sách sản phẩm không hợp lệ." });
    }

    let totalWeight = 0;

    for (const item of selectedItems) {
      console.log(`🔍 Đang tìm sản phẩm: ID=${item.product_id}, Category=${item.category}, Theme=${item.theme}`);

      const product = await Product.findOne({ _id: item.product_id });

      if (!product) {
        console.warn(`⚠️ Không tìm thấy sản phẩm với ID: ${item.product_id}`);
        continue;
      }

      // Tìm biến thể (variation) có category và theme phù hợp
      const variation = product.variations.find(
        (v) => v.category === item.category && (!item.theme || v.theme === item.theme)
      );

      if (variation) {
        totalWeight += (variation.weight || 0) * item.quantity;
      } else {
        console.warn(`⚠️ Không tìm thấy biến thể phù hợp cho sản phẩm ID: ${item.product_id}`);
      }
    }

    console.log(`✅ Tổng khối lượng đơn hàng: ${totalWeight} gram`);
    res.json({ totalWeight });
  } catch (error) {
    console.error("❌ Lỗi khi tính tổng khối lượng:", error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

module.exports = router;

