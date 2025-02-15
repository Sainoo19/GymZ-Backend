const express = require('express');
const Employee = require('../../models/employees'); // Assuming you have an Employee model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all employees from database. */
router.get("/all", async function (req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        branchId,
        role,
        startDate,
        endDate,
        search,
      } = req.query;
  
      // console.log("Received filters:", req.query);
  
      const filters = {};
  
      if (branchId) {
        filters.branch_id = branchId;
      }
  
      if (role) {
        filters.role = new RegExp(`^${role}$`, "i");
      }
  
      if (startDate && endDate) {
        filters.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }
  
      if (search) {
        const searchRegex = new RegExp(search, "i"); // Tạo biểu thức chính quy không phân biệt hoa thường
        filters.$or = [
          { _id: searchRegex }, // Tìm kiếm theo ID
          { name: searchRegex },
          
        ];
      }
  
  
      const employees = await Employee.find(filters)
        .limit(parseInt(limit)) // Lấy giá trị limit từ query parameters hoặc đặt giá trị mặc định là 10
        .skip((parseInt(page) - 1) * parseInt(limit)) // Lấy giá trị page từ query parameters hoặc đặt giá trị mặc định là 1
        .exec();
  
      const count = await Employee.countDocuments(filters);
  
      res.successResponse(
        {
          employees,
        },
        "Fetched all employees successfully",
        200,
        {
          totalEmployees: count,
          pageSize: parseInt(limit),
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / parseInt(limit)),
        }
      );
  
    } catch (err) {
      res.errorResponse(
        "Failed to fetch employees",
        500,
        {},
        { error: err.message }
      );
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

/* DELETE remove all employees */
router.delete("/delete-all", async function (req, res, next) {
    try {
      const result = await Employee.deleteMany({});
      if (result.deletedCount === 0) {
        return res.errorResponse("No employees found to delete", 404);
      }
      res.successResponse(
        { deletedCount: result.deletedCount },
        "All employees deleted successfully"
      );
    } catch (err) {
      res.errorResponse(
        "Failed to delete all employees",
        500,
        {},
        { error: err.message }
      );
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