const express = require("express");
const router = express.Router();
const User = require("../../models/users");
const {authenticate} = require("../../middlewares/auth")

// API GET địa chỉ của user
router.get("/inforDelivery", authenticate, async (req, res) => {
  try {
    const userId = req.user.id; // Lấy userId từ token
    const user = await User.findById(userId).select(
      "address email phone name role status avatar createdAt updatedAt"
    );

    if (!user) {
      return res.status(404).json({
        status: "fail",
        code: 404,
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      code: 200,
      message: "Fetched user successfully",
      data: user,
      metadata: {},
    });
  } catch (error) {
    console.error("Error fetching user address:", error);
    res.status(500).json({
      status: "error",
      code: 500,
      message: "Internal server error",
    });
  }
});

module.exports = router; // Đảm bảo export đúng
