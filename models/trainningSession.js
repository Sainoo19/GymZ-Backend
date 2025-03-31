const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const trainingSessionSchema = new Schema({
    _id: {
        type: String,
        required: true
    },
    userID: {
        type: String,
        required: true
    },
    employeeID: {
        type: String,
        required: true // Giả định rằng phiên tập phải có PT
    },
    dayOfWeek: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] // Giới hạn giá trị
    },
    date: {
        type: Date,
        required: true
    }
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

// Tạo model từ schema
const TrainingSession = mongoose.model('TrainingSession', trainingSessionSchema);

module.exports = TrainingSession;