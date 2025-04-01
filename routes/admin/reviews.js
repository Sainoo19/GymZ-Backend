const express = require("express");
const Review = require("../../models/reviews");
const customResponse = require("../../utils/customResponse");
const generateId = require("../../utils/generateId");
const router = express.Router();
const { authenticate } = require("../../middlewares/auth")

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
// user cmt
router.post("/create", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, rating, comment } = req.body;
    // 🔍 Kiểm tra dữ liệu đầu vào
    if (!product_id || !rating || !comment) {
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
      user_id: userId,
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

router.get("/all/nopagination/:product_id", async function (req, res) {
  try {
    const { product_id } = req.params;

    // Lấy tất cả các đánh giá
    const reviews = await Review.find({ product_id });
    const totalReviews = reviews.length;

    if (reviews.length === 0) {
      return res.errorResponse("Không tìm thấy review cho sản phẩm này", 404, { totalReviews });
    }
    res.successResponse(
      { totalReviews, reviews },
      "Lấy danh sách review thành công"
    );

  } catch (err) {
    res.errorResponse(
      "Failed to fetch reviews",
      500,
      {},
      { error: err.message }
    );
  }
});

//ad rep cmt 
router.post("/reply/:review_id", authenticate, async (req, res) => {
  try {
    const { review_id } = req.params;
    const { comment } = req.body;
    const user_id = req.user.id; // Lấy ID từ token đã xác thực

    const review = await Review.findById(review_id);
    if (!review) {
      return res.status(404).json({ status: "error", message: "Review not found" });
    }

    review.replies.push({ user_id, comment, createdAt: new Date() });

    await review.save();

    res.status(200).json({ status: "success", message: "Reply added successfully", data: review.replies });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Failed to add reply", metadata: { error: err.message } });
  }
});

router.get("/all/:product_id", async (req, res) => {
  try {
    const { product_id } = req.params;

    const page = parseInt(req.query.page) || 1; // Mặc định page = 1
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;
    const reviews = await Review.find({ product_id })
      .skip(skip)
      .limit(limit);

    const totalReviews = await Review.countDocuments({ product_id });

    // const reviews = await Review.find({ product_id });
    // const totalReviews = reviews.length; // Số lượng review


    if (reviews.length === 0) {
      return res.errorResponse("Không tìm thấy review cho sản phẩm này", 404, { totalReviews });
    }

    const totalPages = Math.ceil(totalReviews / limit);

    res.successResponse(
      { totalReviews, totalPages, reviews, currentPage: page },
      "Lấy danh sách review thành công"
    );

    // res.successResponse({ totalReviews, reviews }, "Lấy danh sách review thành công");
  } catch (err) {
    res.errorResponse("Lỗi khi lấy review", 500, {}, { error: err.message });
  }
});

router.put("/updStatus/:review_id", async (req, res) => {
  const { review_id } = req.params;
  const { status } = req.body; // Nhận giá trị status từ request body

  try {
    // Tìm bình luận theo ID và cập nhật status
    const review = await Review.findByIdAndUpdate(
      review_id,
      { status: status }, // Cập nhật status
      { new: true } // Trả về bình luận đã được cập nhật
    );

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Trả về bình luận đã cập nhật
    res.status(200).json({ message: "Review status updated successfully", review });
  } catch (error) {
    res.status(500).json({ message: "Error updating review status", error });
  }
});

// để test thôi kh đc sd
router.delete('/delete/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;

    // Tìm và xóa review theo reviewId
    const deletedReview = await Review.findByIdAndDelete(reviewId);

    if (!deletedReview) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Review not found",
      });
    }

    res.status(200).json({
      status: "success",
      code: 200,
      message: "Review deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      code: 500,
      message: "Failed to delete review",
      data: {},
      metadata: { error: err.message },
    });
  }
});



module.exports = router;
