const mongoose = require('mongoose');

const foodCategorySchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    }
});

const FoodCategory = mongoose.model('FoodCategory', foodCategorySchema);

module.exports = FoodCategory;