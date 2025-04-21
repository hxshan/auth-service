const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { User } = require("../models/user");
const { UserOTPVerification } = require("../models/userOTPVerification");
const { validate, validateLogin } = require("../utils/validation");
const { sendOTPVerificationEmail } = require("../services/emailService");
require("dotenv").config();

// Register user
const signupUser = async (req, res) => {
  try {
    const userData = req.body;

    const { error } = validate(userData);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const userFound = await User.findOne({ email: userData.email });
    if (userFound) {
      return res.status(409).json({ message: "The user already exists" });
    }

    const salt = await bcrypt.genSalt(Number(process.env.SALT));
    const hashPassword = await bcrypt.hash(userData.password, salt);

    const newUser = new User({
      userId: uuidv4(),
      email: userData.email,
      password: hashPassword,
      role: userData.role || "customer",
      verified: false,
    });

    await newUser.save();

    await sendOTPVerificationEmail(newUser);

    return res.status(201).json({
      message: "User created successfully. OTP sent to email for verification.",
      userId: newUser.userId,
    });
  } catch (error) {
    console.error("Error in registering user", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Login user
const loginUser = async (req, res) => {
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const userFound = await User.findOne({ email: req.body.email });
    if (!userFound) {
      return res.status(401).json({ message: "Invalid Email" });
    }

    const validPassword = await bcrypt.compare(
      req.body.password,
      userFound.password
    );
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid Password" });
    }

    const token = userFound.generateAuthToken();
    
    res.status(200).json({
      userId: userFound.userId,
      role: userFound.role,
      token: token,
    });
  } catch (error) {
    console.error("Error in Login user", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "Missing userId or OTP" });
    }

    const userOTPRecord = await UserOTPVerification.findOne({ userId });

    if (!userOTPRecord) {
      return res.status(400).json({
        message: "No OTP record found for this user or it may have expired",
      });
    }

    const { expiresAt, otp: hashedOTP } = userOTPRecord;

    if (Date.now() > expiresAt) {
      await UserOTPVerification.deleteMany({ userId }); // Clean up expired OTPs
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    const isMatch = await bcrypt.compare(otp, hashedOTP);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP is valid — update user as verified
    await User.updateOne({ userId }, { verified: true });

    // Delete the OTP record after successful verification
    await UserOTPVerification.deleteMany({ userId });

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const resendOTP = async (req, res) => {
  try {
    const { userId, email } = req.body;
    if (!userId || !email) {
      return res.status(400).json({ message: "Missing userId or email" });
    }

    // Find the user
    const user = await User.findOne({ userId, email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete previous OTPs
    await UserOTPVerification.deleteMany({ userId });

    // Re-send new OTP
    await sendOTPVerificationEmail(user);

    return res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error resending OTP:", error.message);
    return res.status(500).json({ message: "Error resending OTP" });
  }
};

module.exports = { signupUser, loginUser, verifyOTP, resendOTP };