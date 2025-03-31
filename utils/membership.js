/**
 * Tính giá gói thành viên dựa vào loại và thời hạn
 * @param {string} type - Loại gói (BASIC, SILVER, GOLD, PLATINUM)
 * @param {number} duration - Thời hạn tính bằng tháng (1, 3, 6, 12)
 * @returns {number} Giá gói sau khi tính toán
 */
function calculateMembershipPrice(type, duration) {
    const basePrice = {
        'BASIC': 500000,
        'SILVER': 800000,
        'GOLD': 1200000,
        'PLATINUM': 2000000
    };

    const discountFactor = {
        1: 1,      // Không giảm giá
        3: 0.9,    // Giảm 10%
        6: 0.8,    // Giảm 20%
        12: 0.7    // Giảm 30%
    };

    return basePrice[type] * duration * discountFactor[duration];
}

/**
 * Tính số tiền hoàn trả khi hủy gói
 * @param {string} type - Loại gói (BASIC, SILVER, GOLD, PLATINUM)
 * @param {number} remainingDays - Số ngày còn lại của gói
 * @returns {number} Số tiền hoàn trả
 */
function calculateRefundAmount(type, remainingDays) {
    const basePrice = {
        'BASIC': 500000 / 30,   // Giá tiền 1 ngày
        'SILVER': 800000 / 30,
        'GOLD': 1200000 / 30,
        'PLATINUM': 2000000 / 30
    };

    // Phí hủy sớm 20%
    const cancellationFee = 0.2;

    // Tính toán số tiền hoàn lại
    const refundAmount = basePrice[type] * remainingDays * (1 - cancellationFee);

    return Math.round(refundAmount);
}

/**
 * Lấy dữ liệu về các gói hội viên
 * @returns {Array} Danh sách các gói hội viên và thông tin chi tiết
 */
function getMembershipPlans() {
    return [
        {
            type: 'BASIC',
            name: 'Gói Cơ Bản',
            description: 'Truy cập cơ bản vào phòng tập, không có PT',
            features: [
                'Sử dụng tất cả thiết bị tập luyện',
                'Truy cập phòng tập từ 8h-22h',
                'Không bao gồm các lớp tập theo nhóm'
            ],
            prices: {
                1: 500000,  // 1 tháng
                3: 1350000, // 3 tháng
                6: 2400000, // 6 tháng
                12: 4200000 // 12 tháng
            }
        },
        {
            type: 'SILVER',
            name: 'Gói Bạc',
            description: 'Truy cập đầy đủ với 1 buổi PT mỗi tháng',
            features: [
                'Tất cả tính năng của gói Cơ Bản',
                '1 buổi PT mỗi tháng',
                'Tham gia các lớp tập theo nhóm'
            ],
            prices: {
                1: 800000,
                3: 2160000,
                6: 3840000,
                12: 6720000
            }
        },
        {
            type: 'GOLD',
            name: 'Gói Vàng',
            description: 'Truy cập VIP với 2 buổi PT mỗi tháng',
            features: [
                'Tất cả tính năng của gói Bạc',
                '2 buổi PT mỗi tháng',
                'Ưu tiên đặt lịch các lớp tập',
                'Sử dụng phòng tắm VIP'
            ],
            prices: {
                1: 1200000,
                3: 3240000,
                6: 5760000,
                12: 10080000
            }
        },
        {
            type: 'PLATINUM',
            name: 'Gói Bạch Kim',
            description: 'Truy cập cao cấp nhất với 4 buổi PT mỗi tháng',
            features: [
                'Tất cả tính năng của gói Vàng',
                '4 buổi PT mỗi tháng',
                'Phân tích thể chất chuyên sâu',
                'Tư vấn dinh dưỡng cá nhân hóa',
                'Thẻ khách mời hàng tháng'
            ],
            prices: {
                1: 2000000,
                3: 5400000,
                6: 9600000,
                12: 16800000
            }
        }
    ];
}

/**
 * Tính số buổi PT hàng tháng dựa trên loại gói
 * @param {string} membershipType - Loại gói thành viên
 * @returns {number} Số buổi PT mỗi tháng
 */
function getSessionsPerMonth(membershipType) {
    switch (membershipType) {
        case 'SILVER':
            return 1;
        case 'GOLD':
            return 2;
        case 'PLATINUM':
            return 4;
        default:
            return 0;
    }
}

module.exports = {
    calculateMembershipPrice,
    calculateRefundAmount,
    getMembershipPlans,
    getSessionsPerMonth
};