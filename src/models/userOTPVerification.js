// auth-service/src/models/UserOTPVerification
const mongoose = require("mongoose");

const userOTPVerificationSchema = new mongoose.Schema({
  userId:{
    type:String,
    required: true,
  },
  otp:{
    type:String,
    required:true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from creation
  }
});

const UserOTPVerification = mongoose.model("UserOTPVerification" , userOTPVerificationSchema);
module.exports = { UserOTPVerification }
