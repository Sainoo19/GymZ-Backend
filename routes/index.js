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

/* GET training sessions for an employee on a specific date */
router.get('/employee/:employeeId/sessions', async function (req, res, next) {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    // Validate that date parameter is provided
    if (!date) {
      return res.errorResponse('Thiếu tham số ngày (date)', 400);
    }

    // Validate date format
    const sessionDate = new Date(date);
    if (isNaN(sessionDate)) {
      return res.errorResponse('Định dạng ngày không hợp lệ, sử dụng định dạng YYYY-MM-DD', 400);
    }

    // Create date range for the entire day
    const startOfDay = new Date(sessionDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(sessionDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find all sessions for this employee on the given date
    const sessions = await TrainingSession.find({
      employeeID: employeeId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).sort({ startHour: 1 });

    // Get user details for each session
    const sessionsWithUserDetails = await Promise.all(
      sessions.map(async (session) => {
        const user = await User.findById(session.userID, 'name avatar');
        return {
          ...session.toObject(),
          user: user ? {
            name: user.name,
            avatar: user.avatar
          } : null
        };
      })
    );

    // Return the sessions with additional metadata
    res.successResponse(
      sessionsWithUserDetails,
      `Lấy danh sách buổi tập của huấn luyện viên ngày ${sessionDate.toLocaleDateString('vi-VN')} thành công`,
      200,
      {
        employeeId,
        date: sessionDate.toISOString().split('T')[0],
        sessionCount: sessions.length
      }
    );
  } catch (err) {
    console.error("Error fetching employee sessions:", err);
    res.errorResponse('Không thể lấy danh sách buổi tập', 500, {}, { error: err.message });
  }
});


module.exports = router;
