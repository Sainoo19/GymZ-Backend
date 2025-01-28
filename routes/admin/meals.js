const express = require('express');
const Meal = require('../../models/meals'); // Assuming you have a Meal model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all meals from database. */
router.get('/all', async function (req, res, next) {
    try {
        const meals = await Meal.find();
        res.successResponse(meals, 'Fetched all meals successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch meals', 500, {}, { error: err.message });
    }
});

/* POST create a new meal */
router.post('/create', async function (req, res, next) {
    try {
        const newMealId = await generateId('ML');
        const newMeal = new Meal({
            _id: newMealId,
            ...req.body
        });
        await newMeal.save();
        res.successResponse(newMeal, 'Meal created successfully');
    } catch (err) {
        res.errorResponse('Failed to create meal', 500, {}, { error: err.message });
    }
});

/* PUT update an existing meal */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedMeal = await Meal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedMeal) {
            return res.errorResponse('Meal not found', 404);
        }
        res.successResponse(updatedMeal, 'Meal updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update meal', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing meal */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedMeal = await Meal.findByIdAndDelete(req.params.id);
        if (!deletedMeal) {
            return res.errorResponse('Meal not found', 404);
        }
        res.successResponse(deletedMeal, 'Meal deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete meal', 500, {}, { error: err.message });
    }
});

/* GET meal by id */
router.get('/:id', async function (req, res, next) {
    try {
        const meal = await Meal.findById(req.params.id);
        if (!meal) {
            return res.errorResponse('Meal not found', 404);
        }
        res.successResponse(meal, 'Fetched meal successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch meal', 500, {}, { error: err.message });
    }
});

module.exports = router;