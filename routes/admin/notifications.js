const express = require("express");
const Notification = require("../../models/Notification");
const router = express.Router();
const { authenticate } = require("../../middlewares/auth");

router.get("/", authenticate, async (req, res) => {
    try {
      const notifications = await Notification.find({ employee_id: req.user.id }).sort({ createdAt: -1 });
      return res.json({ data: notifications });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi khi lấy thông báo", error: error.message });
    }
  });
  module.exports = router;
