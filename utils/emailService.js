const nodemailer = require('nodemailer');
const formatCurrency = require('./formatCurrency');

// Cấu hình transporter cho nodemailer
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Hàm gửi email HTML thông báo đơn hàng
const sendOrderConfirmationEmail = async (userEmail, orderDetails, paymentDetails) => {
    const {
        _id: orderId,
        totalPrice,
        shippingFee,
        status,
        deliveryName,
        deliveryPhoneNumber,
        deliveryAdress,
        items,
        createdAt
    } = orderDetails;

    // Format ngày tháng
    const orderDate = new Date(createdAt).toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Tạo chuỗi HTML cho các sản phẩm trong đơn hàng
    let productsHtml = '';
    items.forEach(item => {
        productsHtml += `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e1e1e1;">
                    <div style="display: flex; align-items: center;">
                        <div>
                            <h4 style="margin: 0; color: #333;">${item.productName || 'Sản phẩm'}</h4>
                            <p style="margin: 4px 0 0; color: #666; font-size: 12px;">
                                ${item.category}${item.theme ? `, ${item.theme}` : ''}
                            </p>
                        </div>
                    </div>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e1e1e1; text-align: center;">${formatCurrency(item.price)} VND</td>
                <td style="padding: 12px; border-bottom: 1px solid #e1e1e1; text-align: center;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e1e1e1; text-align: right; font-weight: 500;">${formatCurrency(item.price * item.quantity)} VND</td>
            </tr>
        `;
    });

    // Xác định trạng thái thanh toán và phương thức thanh toán
    const paymentMethod = paymentDetails?.paymentMethod === 'momo'
        ? 'Thanh toán qua Ví MoMo'
        : 'Thanh toán khi nhận hàng (COD)';

    const paymentStatus = paymentDetails?.paymentMethod === 'momo'
        ? '<span style="color: #28a745; font-weight: 500;">Đã thanh toán</span>'
        : '<span style="color: #ffc107; font-weight: 500;">Chờ thanh toán khi nhận hàng</span>';

    // Tạo HTML cho email
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác nhận đơn hàng</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; color: #333;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
            <tr>
                <td style="padding: 20px 0; text-align: center; background-color: #4c1d95;">
                    <h1 style="color: #fff; margin: 0; padding: 0;">GymZ</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px 20px;">
                    <h2 style="margin-top: 0; color: #4c1d95;">Cảm ơn bạn đã đặt hàng!</h2>
                    <p style="margin-bottom: 25px;">Xin chào <strong>${deliveryName}</strong>, chúng tôi đã nhận được đơn hàng của bạn và đang xử lý.</p>
                    
                    <div style="background-color: #f8f9fa; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
                        <h3 style="margin-top: 0; color: #4c1d95; margin-bottom: 10px;">Thông tin đơn hàng</h3>
                        <p style="margin: 5px 0;"><strong>Mã đơn hàng:</strong> ${orderId}</p>
                        <p style="margin: 5px 0;"><strong>Ngày đặt hàng:</strong> ${orderDate}</p>
                        <p style="margin: 5px 0;"><strong>Trạng thái đơn hàng:</strong> <span style="color: #4c1d95; font-weight: 500;">${status}</span></p>
                        <p style="margin: 5px 0;"><strong>Phương thức thanh toán:</strong> ${paymentMethod}</p>
                        <p style="margin: 5px 0;"><strong>Trạng thái thanh toán:</strong> ${paymentStatus}</p>
                    </div>

                    <div style="margin-bottom: 25px;">
                        <h3 style="margin-top: 0; color: #4c1d95; margin-bottom: 10px;">Thông tin giao hàng</h3>
                        <p style="margin: 5px 0;"><strong>Người nhận:</strong> ${deliveryName}</p>
                        <p style="margin: 5px 0;"><strong>Số điện thoại:</strong> ${deliveryPhoneNumber}</p>
                        <p style="margin: 5px 0;"><strong>Địa chỉ:</strong> ${deliveryAdress.street}, ${deliveryAdress.ward}, ${deliveryAdress.district}, ${deliveryAdress.province}</p>
                    </div>

                    <h3 style="margin-top: 0; color: #4c1d95; margin-bottom: 15px;">Chi tiết đơn hàng</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e1e1e1;">Sản phẩm</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e1e1e1;">Đơn giá</th>
                                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e1e1e1;">SL</th>
                                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e1e1e1;">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productsHtml}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3" style="padding: 12px; text-align: right; font-weight: 500;">Tạm tính:</td>
                                <td style="padding: 12px; text-align: right;">${formatCurrency(totalPrice)} VND</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="padding: 12px; text-align: right; font-weight: 500;">Phí vận chuyển:</td>
                                <td style="padding: 12px; text-align: right;">${formatCurrency(shippingFee)} VND</td>
                            </tr>
                            <tr>
                                <td colspan="3" style="padding: 12px; text-align: right; font-weight: 700; color: #4c1d95;">Tổng cộng:</td>
                                <td style="padding: 12px; text-align: right; font-weight: 700; color: #4c1d95; font-size: 18px;">${formatCurrency(totalPrice + shippingFee)} VND</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div style="margin-top: 30px; text-align: center; padding: 15px; border-top: 1px solid #e1e1e1;">
                        <p style="margin: 10px 0;">Nếu bạn có bất kỳ câu hỏi nào về đơn hàng, vui lòng liên hệ với chúng tôi qua email: <a href="mailto:support@gymz.com" style="color: #4c1d95;">support@gymz.com</a></p>
                        <p style="margin: 10px 0;">Hoặc gọi số điện thoại: <strong>1900 1234</strong></p>
                    </div>
                </td>
            </tr>
            <tr>
                <td style="padding: 20px; text-align: center; background-color: #f8f9fa; border-top: 1px solid #e1e1e1;">
                    <p style="margin: 0; font-size: 12px; color: #666;">© 2023 GymZ. Tất cả các quyền được bảo lưu.</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `[GymZ] Xác nhận đơn hàng #${orderId}`,
        html: htmlContent
    };

    await transporter.sendMail(mailOptions);
};

module.exports = {
    sendOrderConfirmationEmail
};