const express = require("express");
const Review = require("../../models/reviews");
const customResponse = require("../../utils/customResponse");
const generateId = require("../../utils/generateId");
const router = express.Router();

router.use(customResponse);

router.get("/all", async function (req, res, next) {
  try {
    const reviews = await Review.find();
    res.successResponse(reviews, "Fetched all reviews successfully");
  } catch (err) {
    res.errorResponse(
      "Failed to fetch reviews",
      500,
      {},
      { error: err.message }
    );
  }
});
router.post("/create", async (req, res) => {
  try {
    const { user_id, product_id, rating, comment } = req.body;

    // 🔍 Kiểm tra dữ liệu đầu vào
    if (!user_id || !product_id || !rating || !comment) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Missing required fields",
        data: {},
        metadata: {
          error:
            "Fields user_id, product_id, rating, and comment are required.",
        },
      });
    }

    // 📌 Kiểm tra rating hợp lệ (1 - 5)
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        status: "error",
        code: 400,
        message: "Invalid rating value",
        data: {},
        metadata: { error: "Rating must be between 1 and 5." },
      });
    }

    // 🆕 Tạo ID review mới
    const newReviewId = await generateId("REV");

    // ✅ Tạo và lưu review
    const newReview = new Review({
      _id: newReviewId,
      user_id,
      product_id,
      rating,
      comment,
    });

    await newReview.save();

    res.status(200).json({
      status: "success",
      code: 200,
      message: "Review created successfully",
      data: newReview,
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: 500,
      message: "Failed to create review",
      data: {},
      metadata: { error: err.message },
    });
  }
});
router.get("/:product_id", async (req, res) => {
  try {
    const { product_id } = req.params;
    const reviews = await Review.find({ product_id });
    const totalReviews = reviews.length; // Số lượng review


    if (reviews.length === 0) {
        return res.errorResponse("Không tìm thấy review cho sản phẩm này", 404, { totalReviews });
    }

    res.successResponse({ totalReviews, reviews }, "Lấy danh sách review thành công");
  } catch (err) {
    res.errorResponse("Lỗi khi lấy review", 500, {}, { error: err.message });
  }
});
module.exports = router;
