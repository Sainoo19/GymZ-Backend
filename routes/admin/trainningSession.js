const express = require('express');
const TrainingSession = require('../../models/trainningSession'); // Assuming you have a TrainingSession model
const Member = require('../../models/members'); // For validation
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const { authenticate, authorize } = require('../../middlewares/auth');
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
        // Check if the member exists
        const member = await Member.findById(req.body.memberID);
        if (!member) {
            return res.errorResponse('Member not found', 404);
        }

        // Validation for manager role: can only create sessions for their branch
        if (req.user.role === 'manager' && member.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only create sessions for members in your branch', 403);
        }

        // Validation for PT role: can only create sessions for members assigned to them
        if (req.user.role === 'PT' && member.employeeID !== req.user.id) {
            return res.errorResponse('You can only create sessions for members assigned to you', 403);
        }

        const newSessionId = await generateId('TS');
        const newSession = new TrainingSession({
            _id: newSessionId,
            employeeID: req.user.role === 'PT' ? req.user.id : req.body.employeeID,
            branchID: member.branchID,
            createdBy: req.user.id,
            ...req.body
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

        // Validation for manager role: can only update sessions in their branch
        if (req.user.role === 'manager' && session.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only update sessions in your branch', 403);
        }

        // Validation for PT role: can only update their own sessions
        if (req.user.role === 'PT' && session.employeeID !== req.user.id) {
            return res.errorResponse('You can only update your own sessions', 403);
        }

        // If trying to change member, validate the new member
        if (req.body.memberID && req.body.memberID !== session.memberID) {
            const member = await Member.findById(req.body.memberID);
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

        const updatedSession = await TrainingSession.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body,
                updatedAt: new Date(),
                updatedBy: req.user.id
            },
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

        // Validation for manager role: can only delete sessions in their branch
        if (req.user.role === 'manager' && session.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only delete sessions in your branch', 403);
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

        // Validation for manager role: can only view sessions in their branch
        if (req.user.role === 'manager' && session.branchID !== req.user.branch_id) {
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