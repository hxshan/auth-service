// auth-service/src/models/User.js
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  roles: {
    type: [String],
    enum: ["customer", "restaurant", "driver"],
  },
  status: {
    type: String,
    enum: ["inactive", "active", "pending", "suspended", "banned"],
    default: "inactive",
  },
  roleStatus: {
    type: Map,
    of: {
      type: String,
      enum: ["inactive", "active", "pending", "suspended"]
    },
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    {
      _id: this._id,
      userId: this.userId,
      roles: this.roles,
      roleStatus: this.roleStatus
    },
    process.env.JWTPRIVATEKEY,
    { expiresIn: "7d" }
  );
  return token;
};

const User = mongoose.model("User", userSchema);
module.exports = { User };
