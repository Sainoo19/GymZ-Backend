const Counter = require('../models/counter'); // Model để quản lý các sequence

const generateId = async (type) => {
    try {
        // Tìm hoặc cập nhật sequence theo loại ID
        const counter = await Counter.findByIdAndUpdate(
            { _id: type }, // Mỗi loại ID có một `_id` riêng trong collection Counter
            { $inc: { seq: 1 } }, // Tăng giá trị `seq` lên 1
            { new: true, upsert: true } // Nếu chưa tồn tại thì tạo mới
        );

        // Lấy số thứ tự mới từ Counter
        const newIdNumber = counter.seq;

        // Tính số chữ số cần thiết và tạo ID
        const numberOfDigits = Math.max(3, newIdNumber.toString().length); // Đảm bảo luôn có ít nhất 3 chữ số
        const newId = type.toUpperCase() + newIdNumber.toString().padStart(numberOfDigits, '0');

        return newId; // Trả về ID mới
    } catch (error) {
        console.error(`Error generating ID for ${type}:`, error);
        throw new Error(`Unable to generate ID for ${type}`);
    }
};

module.exports = generateId;
