const mongoose = require('mongoose');

const logMealSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    note: { type: String, required: true },
    status: { type: String, required: true, enum: ['completed', 'pending', 'cancelled'] }
});

const LogMeal = mongoose.model('LogMeal', logMealSchema);

module.exports = LogMeal;