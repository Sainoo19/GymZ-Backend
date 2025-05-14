const mongoose = require('mongoose');

const mockProductData = {
    _id: 'PR0001',
    name: 'Test Protein Powder',
    description: 'A test product description',
    category: 'CAT001',
    brand: 'Test Brand',
    avatar: 'test-image.jpg',
    variations: [
        {
            _id: new mongoose.Types.ObjectId(),
            category: 'Protein',  // Changed from size to category
            theme: 'Chocolate',   // Changed from color to theme
            stock: 10,
            salePrice: 100000,
            originalPrice: 150000,
            weight: 1            // Added required weight field
        },
        {
            _id: new mongoose.Types.ObjectId(),
            category: 'Protein',  // Changed from size to category
            theme: 'Vanilla',     // Changed from color to theme
            stock: 5,
            salePrice: 120000,
            originalPrice: 170000,
            weight: 1            // Added required weight field
        }
    ],
    images: ['image1.jpg', 'image2.jpg'],
    status: 'active'
};

const mockCategoryData = {
    _id: 'CAT001',
    name: 'Supplements',
    description: 'Nutritional supplements for fitness'  // Added required description
};

module.exports = { mockProductData, mockCategoryData };