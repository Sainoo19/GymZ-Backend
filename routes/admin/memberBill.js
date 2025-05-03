const express = require('express');
const MemberBill = require('../../models/memberBill');
const Member = require('../../models/members');
const User = require('../../models/users');
const customResponse = require('../../utils/customResponse');
const { authenticate, authorize } = require('../../middlewares/auth');
const router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET all member bills with pagination, filtering, and role-based access */
router.get('/all', authenticate, authorize(['admin', 'manager', 'staff']), async function (req, res, next) {
    try {
        const { page = 1, limit = 10, branchId, startDate, endDate, status, search } = req.query;

        const filters = {};

        // Apply role-based filters
        if (req.user.role === 'manager' || req.user.role === 'staff') {
            // Managers and staff can only see bills from their branch
            // We need to join with Member to filter by branch
            const membersInBranch = await Member.find({ branchID: req.user.branch_id }, { _id: 1 });
            const memberIds = membersInBranch.map(member => member._id);
            filters.memberID = { $in: memberIds };
        }

        // Additional filters from query parameters
        if (branchId && req.user.role === 'admin') {
            const membersInBranch = await Member.find({ branchID: branchId }, { _id: 1 });
            const memberIds = membersInBranch.map(member => member._id);
            filters.memberID = { $in: memberIds };
        }

        if (status) {
            if (status === 'paid') {
                filters.paymentDate = { $ne: null };
            } else if (status === 'unpaid') {
                filters.paymentDate = null;
            }
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
                { memberID: searchRegex },
                { description: searchRegex }
            ];
        }

        const bills = await MemberBill.find(filters)
            .sort({ createdAt: -1 }) // Most recent bills first
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .exec();

        const count = await MemberBill.countDocuments(filters);

        // Fetch member and user details for each bill to include in response
        const billsWithDetails = await Promise.all(
            bills.map(async (bill) => {
                const member = await Member.findById(bill.memberID);
                const user = member ? await User.findById(member.userID) : null;

                return {
                    ...bill.toObject(),
                    member: member ? {
                        _id: member._id,
                        type: member.type,
                        branchID: member.branchID,
                        status: member.status
                    } : null,
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
                bills: billsWithDetails,
            },
            'Lấy danh sách hóa đơn thành công',
            200,
            {
                totalBills: count,
                pageSize: parseInt(limit),
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / parseInt(limit)),
            }
        );
    } catch (err) {
        res.errorResponse('Không thể lấy danh sách hóa đơn', 500, {}, { error: err.message });
    }
});

/* GET all bills without pagination */
router.get('/all/nopagination', authenticate, authorize(['admin', 'manager', 'staff']), async function (req, res, next) {
    try {
        const filters = {};

        // Apply role-based filters
        if (req.user.role === 'manager' || req.user.role === 'staff') {
            // Managers and staff can only see bills from their branch
            const membersInBranch = await Member.find({ branchID: req.user.branch_id }, { _id: 1 });
            const memberIds = membersInBranch.map(member => member._id);
            filters.memberID = { $in: memberIds };
        }

        const bills = await MemberBill.find(filters).sort({ createdAt: -1 });
        res.successResponse(bills, 'Lấy danh sách hóa đơn thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy danh sách hóa đơn', 500, {}, { error: err.message });
    }
});

/* PUT update an existing bill */
router.put('/update/:id', authenticate, authorize(['admin', 'manager', 'staff']), async function (req, res, next) {
    try {
        const bill = await MemberBill.findById(req.params.id);

        if (!bill) {
            return res.errorResponse('Không tìm thấy hóa đơn', 404);
        }

        // Validation for manager/staff role: can only update bills from their branch
        if (req.user.role === 'manager' || req.user.role === 'staff') {
            const member = await Member.findById(bill.memberID);
            if (!member || member.branchID !== req.user.branch_id) {
                return res.errorResponse('Bạn chỉ có thể cập nhật hóa đơn từ chi nhánh của mình', 403);
            }
        }

        // // Don't allow updating certain fields if bill is already paid
        // if (bill.paymentDate && (req.body.amount || req.body.memberID || req.body.description)) {
        //     return res.errorResponse('Không thể thay đổi thông tin cơ bản của hóa đơn đã thanh toán', 400);
        // }

        const updatedBill = await MemberBill.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.successResponse(updatedBill, 'Cập nhật hóa đơn thành công');
    } catch (err) {
        res.errorResponse('Không thể cập nhật hóa đơn', 500, {}, { error: err.message });
    }
});

/* DELETE remove an existing bill */
router.delete('/delete/:id', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
    try {
        const bill = await MemberBill.findById(req.params.id);

        if (!bill) {
            return res.errorResponse('Không tìm thấy hóa đơn', 404);
        }

        // Prevent deletion of paid bills
        if (bill.paymentDate) {
            return res.errorResponse('Không thể xóa hóa đơn đã thanh toán', 400);
        }

        // Validation for manager role: can only delete bills from their branch
        if (req.user.role === 'manager') {
            const member = await Member.findById(bill.memberID);
            if (!member || member.branchID !== req.user.branch_id) {
                return res.errorResponse('Bạn chỉ có thể xóa hóa đơn từ chi nhánh của mình', 403);
            }
        }

        const deletedBill = await MemberBill.findByIdAndDelete(req.params.id);
        res.successResponse(deletedBill, 'Xóa hóa đơn thành công');
    } catch (err) {
        res.errorResponse('Không thể xóa hóa đơn', 500, {}, { error: err.message });
    }
});

/* GET bill by id */
router.get('/:id', authenticate, authorize(['admin', 'manager', 'staff']), async function (req, res, next) {
    try {
        const bill = await MemberBill.findById(req.params.id);

        if (!bill) {
            return res.errorResponse('Không tìm thấy hóa đơn', 404);
        }

        // Validation for manager/staff role: can only view bills from their branch
        if (req.user.role === 'manager' || req.user.role === 'staff') {
            const member = await Member.findById(bill.memberID);
            if (!member || member.branchID !== req.user.branch_id) {
                return res.errorResponse('Bạn chỉ có thể xem hóa đơn từ chi nhánh của mình', 403);
            }
        }

        // Get member and user details
        const member = await Member.findById(bill.memberID);
        const user = member ? await User.findById(member.userID) : null;

        res.successResponse({
            ...bill.toObject(),
            member: member ? {
                _id: member._id,
                type: member.type,
                validFrom: member.validFrom,
                validUntil: member.validUntil,
                branchID: member.branchID,
                status: member.status
            } : null,
            user: user ? {
                name: user.name,
                email: user.email,
                phone: user.phone
            } : null
        }, 'Lấy thông tin hóa đơn thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy thông tin hóa đơn', 500, {}, { error: err.message });
    }
});

/* GET bills for a specific member */
router.get('/member/:memberId', authenticate, authorize(['admin', 'manager', 'staff']), async function (req, res, next) {
    try {
        const { memberId } = req.params;

        // Validate member exists
        const member = await Member.findById(memberId);
        if (!member) {
            return res.errorResponse('Không tìm thấy hội viên', 404);
        }

        // Validation for manager/staff role: can only view members from their branch
        if ((req.user.role === 'manager' || req.user.role === 'staff') && member.branchID !== req.user.branch_id) {
            return res.errorResponse('Bạn chỉ có thể xem hóa đơn của hội viên từ chi nhánh của mình', 403);
        }

        // Get all bills for this member
        const bills = await MemberBill.find({ memberID: memberId }).sort({ createdAt: -1 });

        res.successResponse(bills, 'Lấy danh sách hóa đơn của hội viên thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy danh sách hóa đơn của hội viên', 500, {}, { error: err.message });
    }
});

/* GET summary statistics for bills */
router.get('/statistics/summary', authenticate, authorize(['admin', 'manager']), async function (req, res, next) {
    try {
        const { startDate, endDate } = req.query;
        const filters = {};

        // Date range filter
        if (startDate && endDate) {
            filters.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Branch filter for managers
        if (req.user.role === 'manager') {
            const membersInBranch = await Member.find({ branchID: req.user.branch_id }, { _id: 1 });
            const memberIds = membersInBranch.map(member => member._id);
            filters.memberID = { $in: memberIds };
        }

        // Get paid vs unpaid counts
        const totalBills = await MemberBill.countDocuments(filters);
        const paidBills = await MemberBill.countDocuments({
            ...filters,
            paymentDate: { $ne: null }
        });
        const unpaidBills = totalBills - paidBills;

        // Get total amount paid
        const paidBillsAggregate = await MemberBill.aggregate([
            { $match: { ...filters, paymentDate: { $ne: null } } },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
        ]);

        const totalPaid = paidBillsAggregate.length > 0 ? paidBillsAggregate[0].totalAmount : 0;

        // Get total amount pending
        const unpaidBillsAggregate = await MemberBill.aggregate([
            { $match: { ...filters, paymentDate: null } },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
        ]);

        const totalPending = unpaidBillsAggregate.length > 0 ? unpaidBillsAggregate[0].totalAmount : 0;

        res.successResponse({
            totalBills,
            paidBills,
            unpaidBills,
            totalPaid,
            totalPending,
            dateRange: {
                startDate: startDate || "All time",
                endDate: endDate || "Present"
            }
        }, 'Lấy thông tin thống kê hóa đơn thành công');
    } catch (err) {
        res.errorResponse('Không thể lấy thông tin thống kê hóa đơn', 500, {}, { error: err.message });
    }
});

/* POST xác nhận thanh toán */
router.post('/confirm-payment', authenticate, authorize(['admin', 'manager', 'staff']), async function (req, res, next) {
    try {
        const { billId, paymentMethod } = req.body;

        // Validate input
        if (!billId || !paymentMethod) {
            return res.errorResponse('Thiếu thông tin thanh toán cần thiết', 400);
        }

        // Validate paymentMethod
        const validPaymentMethods = ['CASH', 'CREDIT_CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT'];
        if (!validPaymentMethods.includes(paymentMethod)) {
            return res.errorResponse('Phương thức thanh toán không hợp lệ', 400);
        }

        // Tìm bill
        const bill = await MemberBill.findById(billId);
        if (!bill) {
            return res.errorResponse('Không tìm thấy hóa đơn', 404);
        }

        // Tìm member
        const member = await Member.findById(bill.memberID);
        if (!member) {
            return res.errorResponse('Không tìm thấy thông tin hội viên', 404);
        }

        // Kiểm tra trạng thái thanh toán
        if (bill.paymentDate) {
            return res.errorResponse('Hóa đơn này đã được thanh toán', 400);
        }

        // Cập nhật thông tin thanh toán
        const today = new Date();
        bill.paymentDate = today;
        bill.paymentMethod = paymentMethod;

        // Cập nhật thông tin hội viên
        member.validFrom = today;

        // Tính ngày hết hạn dựa vào mô tả hóa đơn
        // Lấy thời hạn từ mô tả hóa đơn (ví dụ: "Đăng ký gói GOLD - 3 tháng")
        const durationMatch = bill.description.match(/(\d+) tháng/);

        if (durationMatch && durationMatch[1]) {
            const duration = parseInt(durationMatch[1]);
            const validUntil = new Date(today);
            validUntil.setMonth(validUntil.getMonth() + duration);
            member.validUntil = validUntil;
        } else {
            // Mặc định 1 tháng nếu không tìm thấy
            const validUntil = new Date(today);
            validUntil.setMonth(validUntil.getMonth() + 1);
            member.validUntil = validUntil;
        }

        // Cập nhật trạng thái hội viên
        member.status = 'ACTIVE';

        // Lưu các thay đổi
        await bill.save();
        await member.save();

        res.successResponse({
            member: {
                id: member._id,
                type: member.type,
                validFrom: member.validFrom,
                validUntil: member.validUntil,
                branchID: member.branchID,
                employeeID: member.employeeID,
                status: member.status
            },
            payment: {
                id: bill._id,
                amount: bill.amount,
                paymentDate: bill.paymentDate,
                paymentMethod: bill.paymentMethod,
                description: bill.description
            }
        }, 'Thanh toán thành công, gói hội viên đã được kích hoạt');
    } catch (err) {
        res.errorResponse('Không thể xử lý thanh toán', 500, {}, { error: err.message });
    }
});

module.exports = router;