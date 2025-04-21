const  mongoose = require("mongoose");

module.exports = ()=>{

    try{
        mongoose.connect(process.env.DBurl);
        console.log("connected to database succesfully")
    }catch(error){
        console.log(error)
        console.log("could not connect to database")
    }
}