const mongoose = require('mongoose');
mongoose.set('strictQuery', true);

const atlat = process.env.MONGODB_URI;


const connect = async () => {
    try {
        await mongoose.connect(atlat, {

        });
        console.log("Connect success");
    } catch (error) {
        console.log("Connect fail");
        console.log(error);
    }
};


module.exports = { connect };
