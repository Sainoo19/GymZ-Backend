const express = require('express');
const bcrypt = require('bcrypt');
const Employee = require('../../models/employees');
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const { authenticate, authorize } = require('../../middlewares/auth');
const router = express.Router();
const { sendOtpEmail, verifyOtp } = require('../../utils/otp');
// Sử dụng middleware customResponse
router.use(customResponse);
const crypto = require('crypto');

router.get('/profile', authenticate, async function (req, res, next) {
  try {
    console.log('Employee ID from token:', req.user.id); // Thêm log để kiểm tra ID nhân viên từ token
    const employee = await Employee.findById(req.user.id);
    if (!employee) {
      return res.errorResponse('Employee not found', 404);
    }
    res.successResponse(employee, 'Fetched employee profile successfully');
  } catch (err) {
    res.errorResponse('Failed to fetch employee profile', 500, {}, { error: err.message });
  }
});
/* GET all employees from database. */
router.get('/all', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
  try {
    const { page = 1, limit = 10, branchId, role, startDate, endDate, search } = req.query;

    const filters = {};

    if (req.user.role === 'manager') {
      filters.branch_id = req.user.branch_id;
      filters.role = 'staff';
    }

    if (branchId) {
      filters.branch_id = branchId;
    }

    if (role) {
      filters.role = new RegExp(`^${role}$`, 'i');
    }

    if (startDate && endDate) {
      filters.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filters.$or = [
        { _id: searchRegex },
        { name: searchRegex },
      ];
    }

    const employees = await Employee.find(filters)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .exec();

    const count = await Employee.countDocuments(filters);

    res.successResponse(
      {
        employees,
      },
      'Fetched all employees successfully',
      200,
      {
        totalEmployees: count,
        pageSize: parseInt(limit),
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
      }
    );
  } catch (err) {
    res.errorResponse('Failed to fetch employees', 500, {}, { error: err.message });
  }
});

/* POST create a new employee */
router.post('/create', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
  try {
    const { password, ...rest } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newEmployeeId = await generateId('EMP');
    const newEmployee = new Employee({
      _id: newEmployeeId,
      ...rest,
      password: hashedPassword,
    });
    await newEmployee.save();
    res.successResponse(newEmployee, 'Employee created successfully');
  } catch (err) {
    res.errorResponse('Failed to create employee', 500, {}, { error: err.message });
  }
});

/* PUT update an existing employee */
router.put('/update/:id', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
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
router.put('/updateEmployee/:id', authenticate,  async function (req, res, next) {
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
router.delete('/delete/:id', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
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
router.get('/:id', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
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

router.get('/all/nopagination', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
  try {
    const { role, branch_id } = req.query;

    const filters = {};

    // Apply role-based access control
    if (req.user.role === 'manager') {
      // Managers can only see employees from their branch
      filters.branch_id = req.user.branch_id;
    }

    // Apply filters from query parameters
    if (role) {
      filters.role = role;
    }

    if (branch_id) {
      // For managers, enforce their branch_id restriction
      if (req.user.role === 'manager' && branch_id !== req.user.branch_id) {
        return res.errorResponse('You can only view employees from your branch', 403);
      }
      filters.branch_id = branch_id;
    }

    const employees = await Employee.find(filters);

    res.successResponse({
      employees
    }, 'Fetched all employees successfully');
  } catch (err) {
    res.errorResponse('Failed to fetch employees', 500, {}, { error: err.message });
  }
});
const isEmployee = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'staff ') {
    // Kiểm tra xem người dùng có phải là nhân viên hay không
      return res.errorResponse('Access denied. You are not an employee', 403);
  }
  console.log("req.user:", req.user);

  next();
};
router.post('/request-password-change', authenticate,isEmployee, async (req, res) => {
  try {
      const { currentPassword } = req.body;
      const employeeId = req.user.id;

      // Tìm nhân viên theo ID
      const employee = await Employee.findById(employeeId);
      if (!employee) {
          return res.errorResponse('Employee not found', 404);
      }
      // Kiểm tra mật khẩu hiện tại của nhân viên
      const isMatch = await bcrypt.compare(currentPassword, employee.password);
      if (!isMatch) {
          return res.errorResponse('Current password is incorrect', 401);
      }

      // Gửi OTP qua email cho nhân viên
      await sendOtpEmail(employee.email, employee.email, 'password-change');

      res.successResponse({}, 'OTP sent successfully');
  } catch (error) {
      console.error('Error requesting password change:', error);
      res.errorResponse('Failed to request password change', 500, {}, { error: error.message });
  }
});
router.post('/verify-change-password-otp', authenticate,isEmployee, async (req, res) => {
  try {
      const { otp } = req.body;
      const employeeId = req.user.id;

      // Tìm nhân viên theo ID
      const employee = await Employee.findById(employeeId);
      if (!employee) {
          return res.errorResponse('Employee not found', 404);
      }
console.log("employee:", employee);
      // Kiểm tra xem OTP đã được gửi chưa
      // Xác minh OTP
      const isOtpValid = await verifyOtp(employee.email, otp, 'password-change');
      if (!isOtpValid) {
          return res.errorResponse('Invalid OTP', 400);
      }

      // Tạo token xác thực tạm thời
      const verificationToken = crypto.randomBytes(20).toString('hex');

      // Lưu token vào kho lưu trữ tạm thời (có thể là Redis hoặc bộ nhớ)
      if (!global.verifiedOtps) {
          global.verifiedOtps = new Map();
      }
      global.verifiedOtps.set(employeeId, { otp, token: verificationToken, timestamp: Date.now() });

      res.successResponse({ verificationToken }, 'OTP verified successfully');
  } catch (error) {
      console.error('Error verifying OTP:', error);
      res.errorResponse('Failed to verify OTP', 500, {}, { error: error.message });
  }
});
router.post('/change-password', authenticate,isEmployee, async (req, res) => {
  try {
      const { otp, newPassword } = req.body;
      const employeeId = req.user.id;

      // Tìm nhân viên theo ID
      const employee = await Employee.findById(employeeId);
      if (!employee) {
          return res.errorResponse('Employee not found', 404);
      }

      // Xác minh OTP
      const isOtpValid = await verifyOtp(employee.email, otp, 'password-change');
      if (!isOtpValid) {
          // Kiểm tra nếu OTP đã được xác minh trước đó
          const verifiedData = global.verifiedOtps && global.verifiedOtps.get(employeeId);

          if (!verifiedData || verifiedData.otp !== otp ||
              Date.now() - verifiedData.timestamp > 300000) { // 5 phút timeout
              return res.errorResponse('Invalid or expired OTP', 400);
          }
      }

      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Cập nhật mật khẩu cho nhân viên
      employee.password = hashedPassword;
      await employee.save();

      // Xóa dữ liệu xác thực tạm thời
      if (global.verifiedOtps) {
          global.verifiedOtps.delete(employeeId);
      }

      res.successResponse({}, 'Password changed successfully');
  } catch (error) {
      console.error('Error changing password:', error);
      res.errorResponse('Failed to change password', 500, {}, { error: error.message });
  }
});

module.exports = router;