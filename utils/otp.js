const nodemailer = require('nodemailer');
const crypto = require('crypto');
const otpStore = new Map(); // Sử dụng Map để lưu trữ OTP tạm thời

// Cấu hình transporter cho nodemailer
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Hàm gửi OTP đến email
const sendOtpEmail = async (currentEmail, targetEmail, purpose = 'email-change') => {
    const otp = generateOtp();

    // Sử dụng key khác nhau cho các mục đích khác nhau
    let key;
    if (purpose === 'password-change') {
        key = `${currentEmail}-pwd`;
    } else if (purpose === 'forgot-password') {
        key = `forgot-${currentEmail}`;
    } else {
        key = currentEmail;
    }

    otpStore.set(key, otp); // Lưu OTP tạm thời

    let subject, text;

    if (purpose === 'password-change') {
        subject = 'Xác thực OTP để đổi mật khẩu';
        text = `Mã OTP của bạn để đổi mật khẩu là: ${otp}`;
    } else if (purpose === 'forgot-password') {
        subject = 'Xác thực OTP để khôi phục mật khẩu';
        text = `Mã OTP của bạn để khôi phục mật khẩu là: ${otp}`;
    } else {
        subject = 'Xác thực OTP để thay đổi email';
        text = `Mã OTP của bạn để thay đổi email là: ${otp}`;
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: currentEmail,
        subject: subject,
        text: text
    };

    await transporter.sendMail(mailOptions);
    return otp; // Trả về OTP cho mục đích debug nếu cần
};

// Hàm tạo OTP ngẫu nhiên
const generateOtp = () => {
    return crypto.randomBytes(3).toString('hex'); // Tạo OTP ngẫu nhiên 6 ký tự
};

// Hàm xác thực OTP
const verifyOtp = async (email, otp, purpose = 'email-change') => {
    let key;
    if (purpose === 'password-change') {
        key = `${email}-pwd`;
    } else if (purpose === 'forgot-password') {
        key = `forgot-${email}`;
    } else {
        key = email;
    }


    const storedOtp = otpStore.get(key);


    if (storedOtp && storedOtp === otp) {
        otpStore.delete(key); // Xóa OTP sau khi xác thực thành công
        return true;
    }
    return false;
};

module.exports = { sendOtpEmail, verifyOtp };