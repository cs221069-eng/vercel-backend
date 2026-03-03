const mongoose = require('mongoose');


const adminSchema = mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true,
        validate: {
            validator: function(v) {
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: "Please enter a valid email"
        }
    },

    password:{
        type:String,
        required:true,
        minLength:6
    }
});

const adminModel = mongoose.model('admin', adminSchema);

module.exports = adminModel;
