const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const exerciseSchema = new Schema({
    exercises_id: { type: String, required: true },
    sets: { type: Number, required: true },
    min_reps: { type: Number, required: true },
    max_reps: { type: Number, required: true }
});

const workoutSchema = new Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    workout_type_id: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    privacy: { type: String, enum: ['public', 'private'], required: true },
    exercises: [exerciseSchema]
});

module.exports = mongoose.model('Workout', workoutSchema);