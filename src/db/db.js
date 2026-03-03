const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL)
.then(()=>{
    console.log("Db connect");
})
.catch((e)=>{
    console.log(e);
})


module.exports = mongoose.connections;