var express = require('express');
const customResponse = require('../utils/customResponse');
const membershipUtils = require('../utils/membership'); // Import membership utils
const Branch = require('../models/branches');
const Employee = require('../models/employees');
var router = express.Router();


// Sử dụng middleware customResponse
router.use(customResponse);
/* GET kiểm tra các gói hội viên hiện có và giá cả */
router.get('/membership-plans', async function (req, res, next) {
  try {
    // Sử dụng utility function để lấy dữ liệu về các gói hội viên
    const membershipPlans = membershipUtils.getMembershipPlans();
    res.successResponse(membershipPlans, 'Lấy thông tin các gói hội viên thành công');
  } catch (err) {
    res.errorResponse('Không thể lấy thông tin gói hội viên', 500, {}, { error: err.message });
  }
});

/* GET all branches from database. */
router.get('/all/home', async function (req, res, next) {
  try {
    const branches = await Branch.find();
    res.successResponse(branches, 'Fetched all branches successfully');
  } catch (err) {
    res.errorResponse('Failed to fetch branches', 500, {}, { error: err.message });
  }
});

/* GET all employees of a selected branch with role 'PT'. */
router.get('/:branchId/employees', async function (req, res, next) {
  try {
    const { branchId } = req.params;
    const employees = await Employee.find({ branch_id: branchId, role: 'PT' });
    res.successResponse(employees, 'Fetched employees with role PT successfully');
  } catch (err) {
    res.errorResponse('Failed to fetch employees', 500, {}, { error: err.message });
  }
});


module.exports = router;
