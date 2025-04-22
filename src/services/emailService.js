// auth-service/src/services/emailService.js
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { UserOTPVerification } = require("../models/userOTPVerification");
require("dotenv").config();

// Create email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.log("Error with email transporter:", error);
  } else {
    console.log("Email service ready");
  }
});

// Generate OTP
const generateOTP = () => {
  // Generate 6-digit OTP
  return `${Math.floor(100000 + Math.random() * 900000)}`;
};

// Send OTP verification email
const sendOTPVerificationEmail = async (user) => {
  try {
    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    // Create email template - safely check the roles
    const roles = user.roles || [];
    const roleSpecificText = Array.isArray(roles) && roles.length > 0 
      ? (roles.includes("restaurant") 
        ? "restaurant owner" 
        : roles.includes("driver") 
          ? "delivery partner" 
          : "customer")
      : "customer"; // Default to customer if no roles or roles is not an array

    const mailOptions = {
      from: process.env.AUTH_EMAIL,
      to: user.email,
      subject: "Verify Your Email - Food Delivery App",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Welcome to Our Food Delivery App!</h2>
            <p style="font-size: 16px; color: #555;">Thank you for registering as a ${roleSpecificText}. Please use the following verification code to complete your registration:</p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; background-color: #FF5A00; color: white; padding: 15px 25px; font-size: 24px; letter-spacing: 4px; border-radius: 6px;">
                ${otp}
              </span>
            </div>
            <p style="font-size: 14px; color: #666;">This code is valid for 5 minutes.</p>
            <p style="font-size: 14px; color: #999;">If you didn't request this code, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    // Delete any existing OTPs for this user
    await UserOTPVerification.deleteMany({ userId: user.userId });

    // Create a new OTP verification record
    const newOTP = new UserOTPVerification({
      userId: user.userId,
      otp: hashedOTP,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    await newOTP.save();
    await transporter.sendMail(mailOptions);
    
    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error.message);
    throw new Error("Failed to send OTP email");
  }
};

module.exports = { 
  sendOTPVerificationEmail,
  generateOTP
};