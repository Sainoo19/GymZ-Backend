const mongoose = require('mongoose');

const workoutTypeSchema = new mongoose.Schema({
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

const WorkoutType = mongoose.model('WorkoutType', workoutTypeSchema);

module.exports = WorkoutType;