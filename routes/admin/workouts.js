const express = require('express');
const Workout = require('../../models/workouts'); // Assuming you have a Workout model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all workouts from database. */
router.get('/all', async (req, res) => {
    try {
        const workouts = await Workout.find();
        res.successResponse(workouts, 'Fetched all workouts successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch workouts', 500, {}, { error: err.message });
    }
});

/* POST create a new workout */
router.post('/create', async (req, res) => {
    try {
        const newWorkoutId = await generateId('WK');
        const newWorkout = new Workout({
            _id: newWorkoutId,
            ...req.body
        });
        await newWorkout.save();
        res.successResponse(newWorkout, 'Workout created successfully');
    } catch (err) {
        res.errorResponse('Failed to create workout', 500, {}, { error: err.message });
    }
});

/* PUT update an existing workout */
router.put('/update/:id', async (req, res) => {
    try {
        const updatedWorkout = await Workout.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedWorkout) {
            return res.errorResponse('Workout not found', 404);
        }
        res.successResponse(updatedWorkout, 'Workout updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update workout', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing workout */
router.delete('/delete/:id', async (req, res) => {
    try {
        const deletedWorkout = await Workout.findByIdAndDelete(req.params.id);
        if (!deletedWorkout) {
            return res.errorResponse('Workout not found', 404);
        }
        res.successResponse(deletedWorkout, 'Workout deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete workout', 500, {}, { error: err.message });
    }
});

/* GET workout by id */
router.get('/:id', async (req, res) => {
    try {
        const workout = await Workout.findById(req.params.id);
        if (!workout) {
            return res.errorResponse('Workout not found', 404);
        }
        res.successResponse(workout, 'Fetched workout successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch workout', 500, {}, { error: err.message });
    }
});

module.exports = router;