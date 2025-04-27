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
const sendOTPVerificationEmail = async (user, specificRole = null) => {
  try {
    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    // Determine which roles to verify
    const rolesToVerify = specificRole ? [specificRole] : (user.roles || []);
    
    if (rolesToVerify.length === 0) {
      throw new Error("No role specified for verification");
    }

    // Generate role-specific text for the email
    let roleSpecificText;
    if (specificRole) {
      // Use the specific role being verified
      roleSpecificText = specificRole === "restaurant" 
        ? "restaurant owner" 
        : specificRole === "driver" 
          ? "delivery partner" 
          : "customer";
    } else {
      // If multiple roles, prioritize restaurant > driver > customer for display
      if (user.roles.includes("restaurant")) {
        roleSpecificText = "restaurant owner";
      } else if (user.roles.includes("driver")) {
        roleSpecificText = "delivery partner";
      } else {
        roleSpecificText = "customer";
      }
    }

    // Create action text based on whether this is a new signup or role addition
    const actionText = specificRole && user.roles.length > 1
      ? `adding the ${roleSpecificText} role to your account`
      : `registering as a ${roleSpecificText}`;

    const mailOptions = {
      from: process.env.AUTH_EMAIL,
      to: user.email,
      subject: "Verify Your Email - Food Delivery App",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #333;">Welcome to Our Food Delivery App!</h2>
            <p style="font-size: 16px; color: #555;">
              Thank you for ${actionText}.
              Please use the following verification code to complete this process:
            </p>
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

    // Delete any existing OTPs for this user and role(s)
    if (specificRole) {
      await UserOTPVerification.deleteMany({ userId: user.userId, role: specificRole });
    } else {
      await UserOTPVerification.deleteMany({ userId: user.userId });
    }

    // Create new OTP verification records for each role being verified
    const otpPromises = rolesToVerify.map(role => {
      const newOTP = new UserOTPVerification({
        userId: user.userId,
        email: user.email,
        role: role,
        otp: hashedOTP,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      });
      
      return newOTP.save();
    });
    
    await Promise.all(otpPromises);

    // Add debugging log to confirm email is being sent
    console.log(`Sending verification email to ${user.email} for role(s): ${rolesToVerify.join(', ')}`);
    
    // Send the email and handle any potential transporter errors
    return new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Email sending failed:", error);
          reject(new Error("Failed to send OTP email"));
        } else {
          console.log("Email sent successfully:", info.response);
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.error("Error in sendOTPVerificationEmail:", error);
    throw new Error("Failed to send OTP email: " + error.message);
  }
};
module.exports = { 
  sendOTPVerificationEmail,
  generateOTP
};