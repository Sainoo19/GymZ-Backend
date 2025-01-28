const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const foodSchema = new Schema({
    food_id: { type: String, required: true },
    quantity: { type: Number, required: true }
});

const mealSchema = new Schema({
    _id: { type: String, required: true },
    user_id: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    mealType: { type: String, required: true },
    totalCalories: { type: Number, required: true },
    foods: [foodSchema]
});

module.exports = mongoose.model('Meal', mealSchema);