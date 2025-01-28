const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const daySchema = new Schema({
    date: {
        type: Number,
        required: true
    },
    logs_meal_id: [{
        type: String,
        required: true
    }]
});

const calendarMealSchema = new Schema({
    _id: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    month: {
        type: Number,
        required: true
    },
    days: [daySchema]
});

module.exports = mongoose.model('CalendarMeal', calendarMealSchema);