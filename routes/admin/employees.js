const express = require('express');
const Employee = require('../../models/employees'); // Assuming you have an Employee model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all employees from database. */
router.get('/all', async function (req, res, next) {
    try {
        const employees = await Employee.find();
        res.successResponse(employees, 'Fetched all employees successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch employees', 500, {}, { error: err.message });
    }
});

/* POST create a new employee */
router.post('/create', async function (req, res, next) {
    try {
        const newEmployeeId = await generateId('EMP');
        const newEmployee = new Employee({
            _id: newEmployeeId,
            ...req.body
        });
        await newEmployee.save();
        res.successResponse(newEmployee, 'Employee created successfully');
    } catch (err) {
        res.errorResponse('Failed to create employee', 500, {}, { error: err.message });
    }
});

/* PUT update an existing employee */
router.put('/update/:id', async function (req, res, next) {
    try {
        const updatedEmployee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedEmployee) {
            return res.errorResponse('Employee not found', 404);
        }
        res.successResponse(updatedEmployee, 'Employee updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update employee', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing employee */
router.delete('/delete/:id', async function (req, res, next) {
    try {
        const deletedEmployee = await Employee.findByIdAndDelete(req.params.id);
        if (!deletedEmployee) {
            return res.errorResponse('Employee not found', 404);
        }
        res.successResponse(deletedEmployee, 'Employee deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete employee', 500, {}, { error: err.message });
    }
});

/* GET employee by id */
router.get('/:id', async function (req, res, next) {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.errorResponse('Employee not found', 404);
        }
        res.successResponse(employee, 'Fetched employee successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch employee', 500, {}, { error: err.message });
    }
});

module.exports = router;