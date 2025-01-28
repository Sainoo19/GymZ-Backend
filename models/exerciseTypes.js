const mongoose = require('mongoose');

const exerciseTypeSchema = new mongoose.Schema({
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

const ExerciseType = mongoose.model('ExerciseType', exerciseTypeSchema);

module.exports = ExerciseType;