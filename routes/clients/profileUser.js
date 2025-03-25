var express = require('express');
const User = require('../../models/users');
const bcrypt = require('bcrypt');
const customResponse = require('../../utils/customResponse');
const { authenticate } = require('../../middlewares/auth');
const { sendOtpEmail, verifyOtp } = require('../../utils/otp'); // Giả sử bạn có các hàm này để gửi và xác thực OTP
var router = express.Router();

// Sử dụng middleware customResponse
router.use(customResponse);

/* GET profile of the logged-in user */
router.get('/profile', authenticate, async function (req, res, next) {
    try {
        console.log('User ID from token:', req.user.id);
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.errorResponse('User not found', 404);
        }
        res.successResponse(user, 'Fetched user profile successfully');
    } catch (err) {
        res.errorResponse('Failed to fetch user profile', 500, {}, { error: err.message });
    }
});

/* PUT update profile of the logged-in user */
router.put('/profile', authenticate, async function (req, res, next) {
    try {
        const { name, phone, avatar, address } = req.body;
        const updatedData = { name, phone, avatar, address };

        const user = await User.findByIdAndUpdate(req.user.id, updatedData, { new: true });
        if (!user) {
            return res.errorResponse('User not found', 404);
        }
        res.successResponse(user, 'Updated user profile successfully');
    } catch (err) {
        res.errorResponse('Failed to update user profile', 500, {}, { error: err.message });
    }
});

/* POST send OTP to the current email */
router.post('/send-otp', authenticate, async function (req, res, next) {
    try {
        const { newEmail } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.errorResponse('User not found', 404);
        }
        await sendOtpEmail(user.email, newEmail); // Gửi OTP đến email hiện tại
        res.successResponse({}, 'OTP sent successfully');
    } catch (err) {
        res.errorResponse('Failed to send OTP', 500, {}, { error: err.message });
    }
});

/* POST verify OTP and update email */
router.post('/verify-otp', authenticate, async function (req, res, next) {
    try {
        const { newEmail, otp } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.errorResponse('User not found', 404);
        }
        const isOtpValid = await verifyOtp(user.email, otp); // Xác thực OTP
        if (!isOtpValid) {
            return res.errorResponse('Invalid OTP', 400);
        }
        user.email = newEmail;
        await user.save();
        res.successResponse(user, 'Email updated successfully');
    } catch (err) {
        res.errorResponse('Failed to verify OTP', 500, {}, { error: err.message });
    }
});
// Middleware kiểm tra xem người dùng có phải là User không
const isUser = (req, res, next) => {
    if (req.user.branch_id) {
        return res.errorResponse('Access denied. This feature is only available for users', 403);
    }
    next();
};
// API đổi mật khẩu cho User - Bước 1: Yêu cầu OTP
router.post('/user/request-password-change', authenticate, isUser, async (req, res) => {
    try {
        const { currentPassword } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.errorResponse('User not found', 404);
        }

        // Kiểm tra mật khẩu hiện tại
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.errorResponse('Current password is incorrect', 401);
        }

        // Gửi OTP qua email
        await sendOtpEmail(user.email, user.email, 'password-change');

        res.successResponse({}, 'OTP sent successfully');
    } catch (error) {
        console.error('Error requesting password change:', error);
        res.errorResponse('Failed to request password change', 500, {}, { error: error.message });
    }
});

// API đổi mật khẩu cho User - Bước 2: Xác minh OTP
router.post('/user/verify-change-password-otp', authenticate, isUser, async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.errorResponse('User not found', 404);
        }

        // Xác minh OTP
        const isOtpValid = await verifyOtp(user.email, otp, 'password-change');
        if (!isOtpValid) {
            return res.errorResponse('Invalid OTP', 400);
        }

        // Lưu thông tin xác thực để sử dụng cho bước tiếp theo
        // Sử dụng một mã token tạm thời để đảm bảo rằng OTP đã được xác minh
        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(20).toString('hex');

        // Lưu token này vào một kho lưu trữ tạm thời (có thể là Redis hoặc memory store)
        // Trong ví dụ này, chúng ta sử dụng Map cho đơn giản
        if (!global.verifiedOtps) {
            global.verifiedOtps = new Map();
        }
        global.verifiedOtps.set(userId, { otp, token: verificationToken, timestamp: Date.now() });

        res.successResponse({ verificationToken }, 'OTP verified successfully');
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.errorResponse('Failed to verify OTP', 500, {}, { error: error.message });
    }
});

// API đổi mật khẩu cho User - Bước 3: Thay đổi mật khẩu
router.post('/user/change-password', authenticate, isUser, async (req, res) => {
    try {
        const { otp, newPassword } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.errorResponse('User not found', 404);
        }

        // Xác minh OTP một lần nữa
        const isOtpValid = await verifyOtp(user.email, otp, 'password-change');
        if (!isOtpValid) {
            // Kiểm tra nếu OTP đã được xác minh trước đó
            const verifiedData = global.verifiedOtps && global.verifiedOtps.get(userId);

            if (!verifiedData || verifiedData.otp !== otp ||
                Date.now() - verifiedData.timestamp > 300000) { // 5 phút timeout
                return res.errorResponse('Invalid or expired OTP', 400);
            }
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Cập nhật mật khẩu
        user.password = hashedPassword;
        await user.save();

        // Xóa dữ liệu xác thực tạm thời
        if (global.verifiedOtps) {
            global.verifiedOtps.delete(userId);
        }

        res.successResponse({}, 'Password changed successfully');
    } catch (error) {
        console.error('Error changing password:', error);
        res.errorResponse('Failed to change password', 500, {}, { error: error.message });
    }
});

router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Tìm kiếm user với email đã cung cấp
        const user = await User.findOne({ email });

        if (!user) {
            // Không trả về lỗi rõ ràng để tránh tiết lộ thông tin tài khoản tồn tại hay không
            return res.successResponse({}, 'If the email exists, an OTP has been sent');
        }

        // Tạo một key đặc biệt cho quên mật khẩu để phân biệt với các OTP khác
        const forgotPasswordKey = `forgot-${email}`;

        // Gửi OTP đến email
        await sendOtpEmail(email, email, 'forgot-password');

        res.successResponse({}, 'If the email exists, an OTP has been sent');
    } catch (error) {
        console.error('Error sending forgot password OTP:', error);
        res.errorResponse('Failed to process request', 500, {}, { error: error.message });
    }
});

// API quên mật khẩu - Bước 2: Xác minh OTP
router.post('/forgot-password/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        // Kiểm tra user có tồn tại không
        const user = await User.findOne({ email });


        if (!user) {
            return res.errorResponse('Invalid email or OTP', 400);
        }

        // Xác minh OTP với purpose 'forgot-password'

        const isOtpValid = await verifyOtp(email, otp, 'forgot-password');


        if (!isOtpValid) {
            return res.errorResponse('Invalid or expired OTP', 400);
        }

        // Lưu trữ thông tin xác thực để sử dụng cho bước tiếp theo
        const crypto = require('crypto');
        const verificationToken = crypto.randomBytes(20).toString('hex');

        if (!global.resetPasswordTokens) {
            global.resetPasswordTokens = new Map();
        }

        global.resetPasswordTokens.set(email, {
            token: verificationToken,
            timestamp: Date.now(),
            otp: otp
        });

        res.successResponse({ verificationToken }, 'OTP verified successfully');
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.errorResponse('Failed to verify OTP', 500, {}, { error: error.message });
    }
});

// API quên mật khẩu - Bước 3: Reset mật khẩu
router.post('/forgot-password/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // Kiểm tra user có tồn tại không
        const user = await User.findOne({ email });

        if (!user) {
            return res.errorResponse('Invalid email', 400);
        }

        // Kiểm tra xem OTP đã được xác minh trước đó chưa
        const resetData = global.resetPasswordTokens && global.resetPasswordTokens.get(email);

        if (!resetData || resetData.otp !== otp ||
            Date.now() - resetData.timestamp > 300000) { // 5 phút timeout
            return res.errorResponse('Invalid or expired reset token', 400);
        }

        // Hash mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Cập nhật mật khẩu
        user.password = hashedPassword;
        await user.save();

        // Xóa token reset password
        global.resetPasswordTokens.delete(email);

        res.successResponse({}, 'Password has been reset successfully');
    } catch (error) {
        console.error('Error resetting password:', error);
        res.errorResponse('Failed to reset password', 500, {}, { error: error.message });
    }
});

module.exports = router;