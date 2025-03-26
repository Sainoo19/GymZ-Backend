const express = require('express');
const TrainingSession = require('../../models/trainningSession'); // Assuming you have a TrainingSession model
const Member = require('../../models/members'); // For validation
const User = require('../../models/users');
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const { checkSchedulingConflicts } = require('../../utils/checkConflict');
const { authenticate, authorize } = require('../../middlewares/auth');
const Employee = require('../../models/employees');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all training sessions with pagination, filtering, and role-based access */
router.get('/all', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const { page = 1, limit = 10, branchId, status, startDate, endDate, search } = req.query;

        const filters = {};

        // Apply role-based filters
        if (req.user.role === 'manager') {
            // Managers can only see sessions from their branch
            filters.branchID = req.user.branch_id;
        } else if (req.user.role === 'PT') {
            // PTs can only see sessions assigned to them
            filters.employeeID = req.user.id;
        }

        // Additional filters from query parameters
        if (branchId && req.user.role === 'admin') {
            filters.branchID = branchId;
        }

        if (status) {
            filters.status = status;
        }

        if (startDate && endDate) {
            filters.sessionDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filters.$or = [
                { _id: searchRegex },
                { memberID: searchRegex },
                { title: searchRegex }
            ];
        }

        const trainingSessions = await TrainingSession.find(filters)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec();

        const count = await TrainingSession.countDocuments(filters);

        res.successResponse({
            trainingSessions
        }, 'Fetched all training sessions successfully', 200, {
            totalSessions: count,
            pageSize: parseInt(limit),
            currentPage: parseInt(page),
            totalPages: Math.ceil(count / parseInt(limit))
        });
    } catch (err) {
        res.errorResponse('Failed to fetch training sessions', 500, {}, { error: err.message });
    }
});

/* GET all training sessions without pagination */
router.get('/all/nopagination', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const filters = {};

        // Apply role-based filters
        if (req.user.role === 'manager') {
            filters.branchID = req.user.branch_id;
        } else if (req.user.role === 'PT') {
            filters.employeeID = req.user.id;
        }

        const trainingSessions = await TrainingSession.find(filters);
        res.successResponse(trainingSessions, 'Fetched all training sessions successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch training sessions', 500, {}, { error: err.message });
    }
});

/* POST create a new training session */
router.post('/create', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        // Check if the user exists (assuming there's a User model)
        const user = await User.findById(req.body.userID);
        if (!user) {
            return res.errorResponse('User not found', 404);
        }

        // Get member information associated with the user
        const member = await Member.findOne({ userID: req.body.userID });
        if (!member) {
            return res.errorResponse('Member not found for this user', 404);
        }

        // Validation for manager role: can only create sessions for members in their branch
        if (req.user.role === 'manager' && member.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only create sessions for members in your branch', 403);
        }

        // Validation for PT role: can only create sessions for members assigned to them
        if (req.user.role === 'PT' && req.user.id !== req.body.employeeID) {
            return res.errorResponse('You can only create sessions for yourself as a PT', 403);
        }

        // If PT is creating a session, enforce that they are the employee assigned
        if (req.user.role === 'PT') {
            req.body.employeeID = req.user.id;
        }

        // Validate date and time
        const sessionDate = new Date(req.body.date);
        if (isNaN(sessionDate)) {
            return res.errorResponse('Invalid date format', 400);
        }

        // Get the day of week if not provided
        if (!req.body.dayOfWeek) {
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            req.body.dayOfWeek = daysOfWeek[sessionDate.getDay()];
        }

        // Validate time format (simple validation)
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(req.body.startHour) || !timeRegex.test(req.body.endHour)) {
            return res.errorResponse('Invalid time format. Use HH:MM format (24-hour)', 400);
        }

        // Validate that end time is after start time
        const [startHour, startMinute] = req.body.startHour.split(':').map(Number);
        const [endHour, endMinute] = req.body.endHour.split(':').map(Number);

        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        if (endMinutes <= startMinutes) {
            return res.errorResponse('End time must be after start time', 400);
        }

        // Check for scheduling conflicts
        try {
            const conflicts = await checkSchedulingConflicts(
                req.body.userID,
                req.body.employeeID,
                sessionDate,
                req.body.startHour,
                req.body.endHour
            );

            if (conflicts.hasConflicts) {
                let conflictMessage = 'Scheduling conflict detected: ';

                if (conflicts.userConflicts.length > 0) {
                    conflictMessage += `User already has ${conflicts.userConflicts.length} session(s) during this time. `;
                }

                if (conflicts.employeeConflicts.length > 0) {
                    conflictMessage += `Trainer already has ${conflicts.employeeConflicts.length} session(s) during this time.`;
                }

                return res.errorResponse(conflictMessage, 409, conflicts);
            }
        } catch (conflictError) {
            return res.errorResponse(conflictError.message, 400);
        }

        // Generate a new ID for the training session
        const newSessionId = await generateId('TS');

        // Create the new training session
        const newSession = new TrainingSession({
            _id: newSessionId,
            userID: req.body.userID,
            employeeID: req.body.employeeID,
            dayOfWeek: req.body.dayOfWeek,
            date: sessionDate,
            status: req.body.status || 'scheduled',
            startHour: req.body.startHour,
            endHour: req.body.endHour
        });

        await newSession.save();
        res.successResponse(newSession, 'Training session created successfully');
    } catch (err) {
        res.errorResponse('Failed to create training session', 500, {}, { error: err.message });
    }
});

/* PUT update an existing training session */
router.put('/update/:id', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const session = await TrainingSession.findById(req.params.id);

        if (!session) {
            return res.errorResponse('Training session not found', 404);
        }

        const employee = await Employee.findById(session.employeeID);
        if (!employee) {
            return res.errorResponse('Không tìm thấy thông tin huấn luyện viên', 404);
        }

        // Validation for manager role: can only update sessions in their branch
        if (req.user.role === 'manager' && employee.branch_id !== req.user.branch_id) {
            return res.errorResponse('You can only update sessions in your branch', 403);
        }

        // Validation for PT role: can only update their own sessions
        if (req.user.role === 'PT' && session.employeeID !== req.user.id) {
            return res.errorResponse('You can only update your own sessions', 403);
        }

        // If trying to change member, validate the new member
        if (req.body.userID && req.body.userID !== session.userID) {
            const member = await Member.findOne({ userID: req.body.userID });
            if (!member) {
                return res.errorResponse('New member not found', 404);
            }

            // Additional validation for the new member
            if (req.user.role === 'manager' && member.branchID !== req.user.branch_id) {
                return res.errorResponse('You can only assign members from your branch', 403);
            }

            if (req.user.role === 'PT' && member.employeeID !== req.user.id) {
                return res.errorResponse('You can only assign members assigned to you', 403);
            }
        }

        // Check for scheduling conflicts if time or date is being updated
        if (req.body.date || req.body.startHour || req.body.endHour) {
            try {
                const checkDate = req.body.date ? new Date(req.body.date) : session.date;
                const checkStartHour = req.body.startHour || session.startHour;
                const checkEndHour = req.body.endHour || session.endHour;
                const checkUserID = req.body.userID || session.userID;
                const checkEmployeeID = req.body.employeeID || session.employeeID;

                const conflicts = await checkSchedulingConflicts(
                    checkUserID,
                    checkEmployeeID,
                    checkDate,
                    checkStartHour,
                    checkEndHour,
                    session._id // Exclude the current session from conflict check
                );

                if (conflicts.hasConflicts) {
                    let conflictMessage = 'Phát hiện xung đột lịch tập: ';

                    if (conflicts.userConflicts.length > 0) {
                        conflictMessage += `Thành viên đã có ${conflicts.userConflicts.length} buổi tập trong khung giờ này. `;
                    }

                    if (conflicts.employeeConflicts.length > 0) {
                        conflictMessage += `Huấn luyện viên đã có ${conflicts.employeeConflicts.length} buổi tập trong khung giờ này.`;
                    }

                    return res.errorResponse(conflictMessage, 409, conflicts);
                }
            } catch (conflictError) {
                return res.errorResponse(conflictError.message, 400);
            }
        }

        // Prepare update data
        const updateData = { ...req.body };

        // Convert date string to Date object if it exists
        if (updateData.date) {
            const updateDate = new Date(updateData.date);
            if (isNaN(updateDate)) {
                return res.errorResponse('Invalid date format', 400);
            }
            updateData.date = updateDate;

            // Update day of week based on new date if not explicitly provided
            if (!updateData.dayOfWeek) {
                const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                updateData.dayOfWeek = daysOfWeek[updateDate.getDay()];
            }
        }

        // Validate time format if provided
        if (updateData.startHour || updateData.endHour) {
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

            if (updateData.startHour && !timeRegex.test(updateData.startHour)) {
                return res.errorResponse('Invalid start time format. Use HH:MM format (24-hour)', 400);
            }

            if (updateData.endHour && !timeRegex.test(updateData.endHour)) {
                return res.errorResponse('Invalid end time format. Use HH:MM format (24-hour)', 400);
            }

            // Check if end time is after start time when both are provided
            if (updateData.startHour && updateData.endHour) {
                const [startHour, startMinute] = updateData.startHour.split(':').map(Number);
                const [endHour, endMinute] = updateData.endHour.split(':').map(Number);

                const startMinutes = startHour * 60 + startMinute;
                const endMinutes = endHour * 60 + endMinute;

                if (endMinutes <= startMinutes) {
                    return res.errorResponse('End time must be after start time', 400);
                }
            }
            // Check if new start time is before existing end time
            else if (updateData.startHour && !updateData.endHour) {
                const [startHour, startMinute] = updateData.startHour.split(':').map(Number);
                const [endHour, endMinute] = session.endHour.split(':').map(Number);

                const startMinutes = startHour * 60 + startMinute;
                const endMinutes = endHour * 60 + endMinute;

                if (endMinutes <= startMinutes) {
                    return res.errorResponse('End time must be after start time', 400);
                }
            }
            // Check if new end time is after existing start time
            else if (!updateData.startHour && updateData.endHour) {
                const [startHour, startMinute] = session.startHour.split(':').map(Number);
                const [endHour, endMinute] = updateData.endHour.split(':').map(Number);

                const startMinutes = startHour * 60 + startMinute;
                const endMinutes = endHour * 60 + endMinute;

                if (endMinutes <= startMinutes) {
                    return res.errorResponse('End time must be after start time', 400);
                }
            }
        }

        // Add metadata about the update
        updateData.updatedAt = new Date();
        if (req.user && req.user.id) {
            updateData.updatedBy = req.user.id;
        }

        const updatedSession = await TrainingSession.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        res.successResponse(updatedSession, 'Training session updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update training session', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing training session */
router.delete('/delete/:id', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const session = await TrainingSession.findById(req.params.id);

        if (!session) {
            return res.errorResponse('Training session not found', 404);
        }
        const employee = await Employee.findById(session.employeeID);
        if (!employee) {
            return res.errorResponse('Không tìm thấy thông tin huấn luyện viên', 404);
        }

        // Validation for manager role: can only update sessions in their branch
        if (req.user.role === 'manager' && employee.branch_id !== req.user.branch_id) {
            return res.errorResponse('Bạn chỉ có thể cập nhật buổi tập trong chi nhánh của mình', 403);
        }

        // Validation for PT role: can only delete their own sessions
        if (req.user.role === 'PT' && session.employeeID !== req.user.id) {
            return res.errorResponse('You can only delete your own sessions', 403);
        }

        const deletedSession = await TrainingSession.findByIdAndDelete(req.params.id);
        res.successResponse(deletedSession, 'Training session deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete training session', 500, {}, { error: err.message });
    }
});

/* GET training session by id */
router.get('/:id', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const session = await TrainingSession.findById(req.params.id);

        if (!session) {
            return res.errorResponse('Training session not found', 404);
        }
        const employee = await Employee.findById(session.employeeID);
        if (!employee) {
            return res.errorResponse('Không tìm thấy thông tin huấn luyện viên', 404);
        }

        // Validation for manager role: can only view sessions in their branch
        if (req.user.role === 'manager' && employee.branch_id !== req.user.branch_id) {
            return res.errorResponse('You can only view sessions in your branch', 403);
        }

        // Validation for PT role: can only view their own sessions
        if (req.user.role === 'PT' && session.employeeID !== req.user.id) {
            return res.errorResponse('You can only view your own sessions', 403);
        }

        res.successResponse(session, 'Fetched training session successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch training session', 500, {}, { error: err.message });
    }
});

module.exports = router;