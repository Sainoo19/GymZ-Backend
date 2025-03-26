const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    employee_id: { type: String, required: true },  // ID nhân viên nhận thông báo
    title: { type: String, required: true },        // Tiêu đề thông báo
    message: { type: String, required: true },      // Nội dung
    isRead: { type: Boolean, default: false },      // Đánh dấu đã đọc
    createdAt: { type: Date, default: Date.now }    // Thời gian tạo
});


const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;

