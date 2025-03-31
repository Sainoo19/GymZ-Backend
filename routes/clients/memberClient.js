const express = require('express');
const Member = require('../../models/members');
const User = require('../../models/users');
const TrainingSession = require('../../models/trainningSession');
const Branch = require('../../models/branches'); // Thêm import cho Branch model
const generateId = require('../../utils/generateId');
const customResponse = require('../../utils/customResponse');
const { authenticate } = require('../../middlewares/auth');
const { checkSchedulingConflicts } = require('../../utils/checkConflict');
const membershipUtils = require('../../utils/membership'); // Import membership utils
const Employee = require('../../models/employees');
const MemberBill = require('../../models/memberBill');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);



/* GET member profile of the logged in user */
router.get('/profile', authenticate, async function (req, res, next) {
    try {
        // Find member associated with the logged-in user
        const member = await Member.findOne({ userID: req.user.id });

        if (!member) {
            return res.errorResponse('Không tìm thấy thông tin thành viên', 404);
        }

        // Get user details
        const user = await User.findById(req.user.id);

        // Format the response
        const memberProfile = {
            ...member.toObject(),
            user: {
                name: user.name,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar
            }
        };

        res.successResponse(memberProfile, 'Lấy thông tin thành viên thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy thông tin thành viên', 500, {}, { error: err.message });
    }
});

/* GET member statistics (membership status, upcoming sessions, etc) */
router.get('/statistics', authenticate, async function (req, res, next) {
    try {
        // Find member associated with the logged-in user
        const member = await Member.findOne({ userID: req.user.id });

        if (!member) {
            return res.errorResponse('Không tìm thấy thông tin thành viên', 404);
        }

        // Calculate days until membership expires
        const today = new Date();
        const validUntil = new Date(member.validUntil);
        const daysRemaining = Math.ceil((validUntil - today) / (1000 * 60 * 60 * 24));

        // Get upcoming training sessions
        const upcomingSessions = await TrainingSession.find({
            userID: req.user.id,
            date: { $gte: today },
            status: 'scheduled'
        }).sort({ date: 1, startHour: 1 }).limit(5);

        // Get upcoming PT details
        let upcomingPT = null;
        if (member.employeeID) {
            upcomingPT = await User.findById(member.employeeID, 'name avatar');
        }

        // Format the response
        const statistics = {
            membershipStatus: today <= validUntil ? 'active' : 'expired',
            membershipType: member.type,
            daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
            validUntil: member.validUntil,
            upcomingSessions: upcomingSessions,
            completedSessions: await TrainingSession.countDocuments({
                userID: req.user.id,
                status: 'completed'
            }),
            personalTrainer: upcomingPT
        };

        res.successResponse(statistics, 'Lấy thông tin thống kê thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy thông tin thống kê', 500, {}, { error: err.message });
    }
});

/* GET all training sessions for the logged in member */
router.get('/trainingSessions', authenticate, async function (req, res, next) {
    try {
        const { page = 1, limit = 10, status, startDate, endDate } = req.query;

        // Build filters
        const filters = { userID: req.user.id };

        if (status) {
            filters.status = status;
        }

        if (startDate || endDate) {
            filters.date = {};
            if (startDate) {
                filters.date.$gte = new Date(startDate);
            }
            if (endDate) {
                filters.date.$lte = new Date(endDate);
            }
        }

        // Get sessions with pagination
        const sessions = await TrainingSession.find(filters)
            .sort({ date: -1, startHour: 1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec();

        // Get total count for pagination
        const count = await TrainingSession.countDocuments(filters);

        // Get trainer details for each session
        const sessionsWithTrainerDetails = await Promise.all(
            sessions.map(async (session) => {
                const trainer = await User.findById(session.employeeID, 'name avatar');
                return {
                    ...session.toObject(),
                    trainer: trainer || null
                };
            })
        );

        res.successResponse(
            {
                sessions: sessionsWithTrainerDetails
            },
            'Lấy danh sách buổi tập thành công',
            200,
            {
                totalSessions: count,
                pageSize: parseInt(limit),
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit))
            }
        );
    } catch (err) {
        res.errorResponse('Không thể lấy danh sách buổi tập', 500, {}, { error: err.message });
    }
});

/* GET a specific training session */
router.get('/trainingSession/:id', authenticate, async function (req, res, next) {
    try {
        const session = await TrainingSession.findById(req.params.id);

        if (!session) {
            return res.errorResponse('Không tìm thấy buổi tập', 404);
        }

        // Verify that this session belongs to the logged-in user
        if (session.userID !== req.user.id) {
            return res.errorResponse('Bạn không có quyền xem buổi tập này', 403);
        }

        // Get trainer details
        const trainer = await User.findById(session.employeeID, 'name avatar');

        const sessionWithDetails = {
            ...session.toObject(),
            trainer: trainer || null
        };

        res.successResponse(sessionWithDetails, 'Lấy thông tin buổi tập thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy thông tin buổi tập', 500, {}, { error: err.message });
    }
});

/* POST cancel training session (change status to cancelled) */
router.post('/cancel-session/:id', authenticate, async function (req, res, next) {
    try {
        const session = await TrainingSession.findById(req.params.id);

        if (!session) {
            return res.errorResponse('Không tìm thấy buổi tập', 404);
        }

        // Verify that this session belongs to the logged-in user
        if (session.userID !== req.user.id) {
            return res.errorResponse('Bạn không có quyền hủy buổi tập này', 403);
        }

        // Verify that the session is in the future and has 'scheduled' status
        const sessionDate = new Date(session.date);
        const today = new Date();

        if (sessionDate < today) {
            return res.errorResponse('Không thể hủy buổi tập đã qua', 400);
        }

        if (session.status !== 'scheduled') {
            return res.errorResponse(`Không thể hủy buổi tập có trạng thái "${session.status}"`, 400);
        }

        // Update the session status
        session.status = 'cancelled';
        await session.save();

        res.successResponse(session, 'Hủy buổi tập thành công');
    } catch (err) {
        res.errorResponse('Không thể hủy buổi tập', 500, {}, { error: err.message });
    }
});


/* POST đăng ký gói hội viên mới */
router.post('/register-membership', authenticate, async function (req, res, next) {
    try {
        // Kiểm tra xem user đã có thông tin hội viên chưa
        let member = await Member.findOne({ userID: req.user.id });
        const { type, duration, branchID, employeeID } = req.body;

        // Validate input
        if (!type || !duration || !branchID) {
            return res.errorResponse('Thiếu thông tin để đăng ký: loại gói, thời hạn, chi nhánh', 400);
        }

        // Validate loại gói
        const validTypes = ['GOLD', 'SILVER', 'PLATINUM', 'BASIC'];
        if (!validTypes.includes(type)) {
            return res.errorResponse('Loại gói không hợp lệ', 400);
        }

        // Validate thời hạn (tháng)
        const validDurations = [1, 3, 6, 12];
        if (!validDurations.includes(parseInt(duration))) {
            return res.errorResponse('Thời hạn không hợp lệ. Chọn 1, 3, 6 hoặc 12 tháng', 400);
        }

        // Kiểm tra chi nhánh có tồn tại
        const branch = await Branch.findById(branchID);
        if (!branch) {
            return res.errorResponse('Chi nhánh không tồn tại', 404);
        }

        // Kiểm tra PT nếu người dùng đã chọn
        if (employeeID) {
            // Không cho phép chọn PT cho gói BASIC
            if (type === 'BASIC') {
                return res.errorResponse('Gói BASIC không bao gồm dịch vụ huấn luyện viên cá nhân', 400);
            }

            // Kiểm tra PT có tồn tại không
            const selectedPT = await Employee.findOne({
                _id: employeeID,
                role: 'PT',
                branch_id: branchID // Đảm bảo PT thuộc chi nhánh đã chọn
            });

            if (!selectedPT) {
                return res.errorResponse('Huấn luyện viên không tồn tại hoặc không thuộc chi nhánh đã chọn', 404);
            }

            // // Kiểm tra xem PT này có thể nhận thêm học viên không
            // const ptCurrentStudentCount = await Member.countDocuments({ employeeID });
            // if (ptCurrentStudentCount >= 20) { // Giả sử giới hạn 20 học viên/PT
            //     return res.errorResponse('Huấn luyện viên này đã đạt giới hạn số lượng học viên', 400);
            // }
        }

        // // Kiểm tra xem gói có PT không và cảnh báo nếu cần
        // const sessionsPerMonth = membershipUtils.getSessionsPerMonth(type);
        // if (sessionsPerMonth > 0 && !employeeID) {
        //     console.log('Cảnh báo: Người dùng đăng ký gói có PT nhưng chưa chọn PT');
        // }

        // Tính toán số tiền thanh toán
        const amount = membershipUtils.calculateMembershipPrice(type, parseInt(duration));

        // Tạo hoặc cập nhật thông tin hội viên
        const today = new Date();

        // Tạo ID cho member và bill
        const memberId = !member ? await generateId('MEM') : member._id;
        const billId = await generateId('BILL');

        // Tạo memberBill
        const memberBill = new MemberBill({
            _id: billId,
            memberID: memberId,
            amount: amount,
            paymentDate: null, // Sẽ được cập nhật khi thanh toán
            paymentMethod: null, // Sẽ được cập nhật khi thanh toán
            description: `Đăng ký gói ${type} - ${duration} tháng${employeeID ? ' với PT' : ''}`
        });

        // Lưu hóa đơn
        await memberBill.save();

        // Nếu chưa có thông tin hội viên, tạo mới
        if (!member) {
            member = new Member({
                _id: memberId,
                userID: req.user.id,
                type,
                validFrom: null, // Sẽ được cập nhật sau khi thanh toán
                validUntil: null, // Sẽ được cập nhật sau khi thanh toán
                branchID,
                employeeID: employeeID || null,
                registerDate: today,
                status: 'INACTIVE' // Trạng thái chờ thanh toán
            });
        } else {
            // Nếu đã là hội viên, tạo yêu cầu gia hạn/nâng cấp
            member.type = type;
            member.branchID = branchID;

            // Chỉ cập nhật PT nếu có chọn
            if (employeeID) {
                member.employeeID = employeeID;
            }

            // Không cập nhật validFrom và validUntil, sẽ làm sau khi thanh toán
            member.status = 'INACTIVE'; // Đặt lại trạng thái
        }

        // Lưu thông tin hội viên
        await member.save();

        // Trả về thông tin đăng ký
        res.successResponse({
            member: {
                id: member._id,
                type: member.type,
                branchID: member.branchID,
                employeeID: member.employeeID,
                registerDate: member.registerDate,
                status: member.status
            },
            bill: {
                id: memberBill._id,
                amount: memberBill.amount,
                description: memberBill.description,
                status: 'pending'
            },
            nextAction: 'payment'
        }, 'Đăng ký gói hội viên thành công, vui lòng thanh toán để hoàn tất đăng ký');
    } catch (err) {
        res.errorResponse('Không thể đăng ký gói hội viên', 500, {}, { error: err.message });
    }
});

/* POST hủy gói hội viên hiện tại */
router.post('/cancel-membership', authenticate, async function (req, res, next) {
    try {
        const member = await Member.findOne({ userID: req.user.id });

        if (!member) {
            return res.errorResponse('Bạn chưa đăng ký làm hội viên', 404);
        }

        const { reason } = req.body;
        const today = new Date();

        // Kiểm tra xem có đủ điều kiện để hủy không
        // Ví dụ: gói phải còn hạn ít nhất 30 ngày
        const validUntil = new Date(member.validUntil);
        const remainingDays = Math.ceil((validUntil - today) / (1000 * 60 * 60 * 24));

        if (remainingDays <= 30) {
            return res.errorResponse(
                'Không thể hủy gói hội viên. Gói của bạn còn ít hơn 30 ngày hoặc đã hết hạn.',
                400
            );
        }

        // Tính toán số tiền hoàn trả (nếu có) - Sử dụng utility function
        const refundAmount = membershipUtils.calculateRefundAmount(member.type, remainingDays);

        // Trong thực tế, có thể không xóa member mà chỉ đánh dấu là đã hủy hoặc cập nhật ngày hết hạn
        // Hoặc chuyển thông tin vào bảng lịch sử hội viên

        // Ghi nhận yêu cầu hủy
        const cancellationRequest = {
            memberId: member._id,
            userId: req.user.id,
            requestDate: today,
            reason: reason || 'Không cung cấp',
            membershipType: member.type,
            originalValidUntil: member.validUntil,
            refundAmount,
            status: 'pending' // cần được admin phê duyệt
        };

        // Trong thực tế, lưu yêu cầu này vào database

        res.successResponse(
            {
                cancellationRequest,
                message: 'Yêu cầu hủy gói hội viên của bạn đã được ghi nhận và đang chờ xác nhận'
            },
            'Gửi yêu cầu hủy gói thành công'
        );
    } catch (err) {
        res.errorResponse('Không thể hủy gói hội viên', 500, {}, { error: err.message });
    }
});


/* GET check trạng thái hội viên chi tiết */
router.get('/membership-status', authenticate, async function (req, res, next) {
    try {
        const member = await Member.findOne({ userID: req.user.id });

        if (!member) {
            return res.errorResponse('Bạn chưa đăng ký làm hội viên', 404);
        }

        const today = new Date();
        const validUntil = new Date(member.validUntil);
        const validFrom = new Date(member.validFrom);
        const daysRemaining = Math.ceil((validUntil - today) / (1000 * 60 * 60 * 24));
        const totalDays = Math.ceil((validUntil - validFrom) / (1000 * 60 * 60 * 24));
        const usedDays = totalDays - daysRemaining;
        const percentRemaining = Math.round((daysRemaining / totalDays) * 100);

        // Lấy thông tin chi nhánh
        const branch = await Branch.findById(member.branchID).select('name address');

        // Lấy thông tin PT nếu có
        let trainer = null;
        if (member.employeeID) {
            trainer = await User.findById(member.employeeID).select('name avatar phone email');
        }

        // Lấy số buổi tập đã sử dụng trong tháng hiện tại
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const sessionsThisMonth = await TrainingSession.countDocuments({
            userID: req.user.id,
            date: {
                $gte: startOfMonth,
                $lte: endOfMonth
            },
            status: 'completed'
        });

        // Số buổi tập còn lại được cấp theo gói - Sử dụng utility function
        const sessionsPerMonth = membershipUtils.getSessionsPerMonth(member.type);
        const remainingSessions = Math.max(0, sessionsPerMonth - sessionsThisMonth);

        const membershipStatus = {
            type: member.type,
            validFrom: member.validFrom,
            validUntil: member.validUntil,
            isActive: today <= validUntil,
            daysRemaining,
            percentRemaining,
            totalDays,
            usedDays,
            branch,
            trainer,
            sessionsUsedThisMonth: sessionsThisMonth,
            sessionsRemainingThisMonth: remainingSessions,
            sessionsPerMonth,
            canCancel: daysRemaining > 30, // Kiểm tra xem có thể hủy gói không
            canUpgrade: today <= validUntil // Có thể nâng cấp nếu gói còn hạn
        };

        res.successResponse(membershipStatus, 'Lấy thông tin trạng thái hội viên thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy thông tin trạng thái hội viên', 500, {}, { error: err.message });
    }
});

/* POST book a new training session */
router.post('/book-session', authenticate, async function (req, res, next) {
    try {
        // Check if the user has an active membership
        const member = await Member.findOne({ userID: req.user.id });

        if (!member) {
            return res.errorResponse('Bạn cần đăng ký làm hội viên trước khi đặt lịch tập', 404);
        }

        // Check if membership is active and not expired
        const today = new Date();
        const validUntil = new Date(member.validUntil);

        if (member.status !== 'ACTIVE' || today > validUntil) {
            return res.errorResponse('Gói hội viên của bạn không còn hiệu lực, vui lòng gia hạn', 403);
        }

        // Make sure all required fields are provided
        const { employeeID, date, startHour, endHour } = req.body;

        if (!employeeID || !date || !startHour || !endHour) {
            return res.errorResponse('Thiếu thông tin bắt buộc: huấn luyện viên, ngày tập, giờ bắt đầu, giờ kết thúc', 400);
        }

        // Validate date format
        const sessionDate = new Date(date);
        if (isNaN(sessionDate)) {
            return res.errorResponse('Định dạng ngày không hợp lệ', 400);
        }

        // Check if session date is within membership validity period
        if (sessionDate > validUntil) {
            return res.errorResponse(
                'Không thể đặt lịch tập sau ngày hết hạn của gói hội viên (' +
                validUntil.toLocaleDateString('vi-VN') + ')',
                400
            );
        }

        // Prevent booking sessions in the past
        if (sessionDate < today) {
            return res.errorResponse('Không thể đặt lịch cho các ngày đã qua', 400);
        }

        // Validate time format
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startHour) || !timeRegex.test(endHour)) {
            return res.errorResponse('Định dạng thời gian không hợp lệ. Sử dụng định dạng HH:MM (24 giờ)', 400);
        }

        // Validate that end time is after start time
        const [startHr, startMin] = startHour.split(':').map(Number);
        const [endHr, endMin] = endHour.split(':').map(Number);

        const startMinutes = startHr * 60 + startMin;
        const endMinutes = endHr * 60 + endMin;

        if (endMinutes <= startMinutes) {
            return res.errorResponse('Giờ kết thúc phải sau giờ bắt đầu', 400);
        }

        // Get the day of week
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = daysOfWeek[sessionDate.getDay()];

        // Verify that the trainer exists and is assigned to the member's branch
        const trainer = await Employee.findOne({
            _id: employeeID,
            role: 'PT',
            branch_id: member.branchID,
            status: 'ACTIVE' // Ensure trainer is active
        });

        if (!trainer) {
            return res.errorResponse('Huấn luyện viên không tồn tại hoặc không làm việc tại chi nhánh của bạn', 404);
        }

        // Check for scheduling conflicts using the utility function
        try {
            const conflicts = await checkSchedulingConflicts(
                req.user.id,
                employeeID,
                sessionDate,
                startHour,
                endHour
            );

            if (conflicts.hasConflicts) {
                let conflictMessage = 'Phát hiện xung đột lịch tập: ';

                if (conflicts.userConflicts.length > 0) {
                    conflictMessage += `Bạn đã có ${conflicts.userConflicts.length} buổi tập trong khung giờ này. `;
                }

                if (conflicts.employeeConflicts.length > 0) {
                    conflictMessage += `Huấn luyện viên đã có ${conflicts.employeeConflicts.length} buổi tập trong khung giờ này.`;
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
            userID: req.user.id,
            employeeID: employeeID,
            dayOfWeek: dayOfWeek,
            date: sessionDate,
            status: 'scheduled',
            startHour: startHour,
            endHour: endHour
        });

        await newSession.save();

        // Get trainer details for response
        const trainerDetails = await User.findById(trainer.userID).select('name avatar');

        // Return session with trainer details
        const sessionResponse = {
            ...newSession.toObject(),
            trainer: trainerDetails || null
        };

        res.successResponse(sessionResponse, 'Đặt lịch tập thành công');
    } catch (err) {
        console.error('Error booking session:', err);
        res.errorResponse('Không thể đặt lịch tập', 500, {}, { error: err.message });
    }
});

module.exports = router;