const mongoose = require('mongoose');
mongoose.set('strictQuery', true);

const atlat = "mongodb+srv://Sainoo19:Sup151151@pokedex.c2vo3.mongodb.net/GymZ?retryWrites=true&w=majority&appName=GymZ";


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
