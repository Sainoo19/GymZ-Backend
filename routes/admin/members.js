const express = require('express');
const Member = require('../../models/members');
const User = require('../../models/users'); // Assuming you have a User model
const customResponse = require('../../utils/customResponse');
const generateId = require('../../utils/generateId');
const { authenticate, authorize } = require('../../middlewares/auth');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all members with pagination, filtering, and role-based access */
router.get('/all', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const { page = 1, limit = 10, branchId, type, startDate, endDate, search } = req.query;

        const filters = {};

        // Apply role-based filters
        if (req.user.role === 'manager') {
            // Managers can only see members from their branch
            filters.branchID = req.user.branch_id;
        } else if (req.user.role === 'PT') {
            // PTs can only see members assigned to them
            filters.employeeID = req.user.id;
        }

        // Additional filters from query parameters
        if (branchId && req.user.role === 'admin') {
            filters.branchID = branchId;
        }

        if (type) {
            filters.type = type;
        }

        if (startDate && endDate) {
            filters.validFrom = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            filters.$or = [
                { _id: searchRegex },
                { userID: searchRegex }
            ];
        }

        const members = await Member.find(filters)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec();

        const count = await Member.countDocuments(filters);

        // Fetch user details for each member to include in response
        const membersWithUserDetails = await Promise.all(
            members.map(async (member) => {
                const user = await User.findById(member.userID);
                return {
                    ...member.toObject(),
                    user: user ? {
                        name: user.name,
                        email: user.email,
                        phone: user.phone
                    } : null
                };
            })
        );

        res.successResponse(
            {
                members: membersWithUserDetails,
            },
            'Fetched all members successfully',
            200,
            {
                totalMembers: count,
                pageSize: parseInt(limit),
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit)),
            }
        );
    } catch (err) {
        res.errorResponse('Failed to fetch members', 500, {}, { error: err.message });
    }
});

/* GET all members without pagination */
router.get('/all/nopagination', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const filters = {};

        // Apply role-based filters
        if (req.user.role === 'manager') {
            filters.branchID = req.user.branch_id;
        } else if (req.user.role === 'PT') {
            filters.employeeID = req.user.id;
        }

        const members = await Member.find(filters);
        res.successResponse(members, 'Fetched all members successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch members', 500, {}, { error: err.message });
    }
});

/* POST create a new member */
router.post('/create', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
    try {
        // Validation for manager role: can only create members for their branch
        if (req.user.role === 'manager' && req.body.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only create members for your branch', 403);
        }

        const newMemberId = await generateId('MEM');
        const newMember = new Member({
            _id: newMemberId,
            ...req.body
        });
        await newMember.save();
        res.successResponse(newMember, 'Member created successfully');
    } catch (err) {
        res.errorResponse('Failed to create member', 500, {}, { error: err.message });
    }
});

/* PUT update an existing member */
router.put('/update/:id', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const member = await Member.findById(req.params.id);

        if (!member) {
            return res.errorResponse('Member not found', 404);
        }

        // Validation for manager role: can only update members from their branch
        if (req.user.role === 'manager' && member.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only update members from your branch', 403);
        }

        // Validation for PT role: can only update members assigned to them
        if (req.user.role === 'PT' && member.employeeID !== req.user.id) {
            return res.errorResponse('You can only update members assigned to you', 403);
        }

        // Limit what PTs can update
        if (req.user.role === 'PT') {
            // PTs can only update limited fields
            const allowedFields = ['trainingNotes', 'progress'];
            Object.keys(req.body).forEach(key => {
                if (!allowedFields.includes(key)) {
                    delete req.body[key];
                }
            });
        }

        const updatedMember = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.successResponse(updatedMember, 'Member updated successfully');
    } catch (err) {
        res.errorResponse('Failed to update member', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing member */
router.delete('/delete/:id', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
    try {
        const member = await Member.findById(req.params.id);

        if (!member) {
            return res.errorResponse('Member not found', 404);
        }

        // Validation for manager role: can only delete members from their branch
        if (req.user.role === 'manager' && member.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only delete members from your branch', 403);
        }

        const deletedMember = await Member.findByIdAndDelete(req.params.id);
        res.successResponse(deletedMember, 'Member deleted successfully');
    } catch (err) {
        res.errorResponse('Failed to delete member', 500, {}, { error: err.message });
    }
});

/* GET member by id */
router.get('/:id', authenticate, authorize(['admin', 'manager', 'PT']), async function (req, res, next) {
    try {
        const member = await Member.findById(req.params.id);

        if (!member) {
            return res.errorResponse('Member not found', 404);
        }

        // Validation for manager role: can only view members from their branch
        if (req.user.role === 'manager' && member.branchID !== req.user.branch_id) {
            return res.errorResponse('You can only view members from your branch', 403);
        }

        // Validation for PT role: can only view members assigned to them
        if (req.user.role === 'PT' && member.employeeID !== req.user.id) {
            return res.errorResponse('You can only view members assigned to you', 403);
        }

        // Get user details
        const user = await User.findById(member.userID);

        res.successResponse({
            ...member.toObject(),
            user: user ? {
                name: user.name,
                email: user.email,
                phone: user.phone
            } : null
        }, 'Fetched member successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch member', 500, {}, { error: err.message });
    }
});

// Make sure to export the router
module.exports = router;