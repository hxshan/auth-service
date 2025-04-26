// auth-service/src/controllers/usersController.js
const { User } = require("../models/user");

class UsersController {
  // Get all users - protected endpoint for admin access
  getAllUsers = async (req, res) => {
    try {
      // Optional query parameters for filtering
      const { role, status, page = 1, limit = 20 } = req.query;
      
      const query = {};
      
      // Add filters if provided
      if (role) {
        query.roles = role;
      }
      
      if (status) {
        // Filter can be either by overall status or role-specific status
        if (status.includes('.')) {
          // For role-specific status (e.g. roleStatus.restaurant=pending)
          const [roleKey, roleStatus] = status.split('.');
          query[`roleStatus.${roleKey}`] = roleStatus;
        } else {
          // For overall status
          query.status = status;
        }
      }
      
      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Get users with pagination
      const users = await User.find(query)
        .select("-password") // Exclude passwords from results
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 }); // Sort by newest first
      
      // Get total count for pagination
      const total = await User.countDocuments(query);
      
      return res.status(200).json({
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error.message);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // Get single user by ID
  getUserById = async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await User.findOne({ userId }).select("-password");
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      return res.status(200).json({ user });
    } catch (error) {
      console.error("Error fetching user:", error.message);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

  // Update user status (admin only)
  updateUserStatus = async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, roleStatus } = req.body;
      
      const user = await User.findOne({ userId });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updateData = {};
      
      // Update overall status if provided
      if (status) {
        if (!["inactive", "active", "pending", "suspended", "banned"].includes(status)) {
          return res.status(400).json({ message: "Invalid status value" });
        }
        updateData.status = status;
      }
      
      // Update role-specific status if provided
      if (roleStatus && typeof roleStatus === 'object') {
        for (const [role, value] of Object.entries(roleStatus)) {
          if (!user.roles.includes(role)) {
            return res.status(400).json({ message: `User does not have the ${role} role` });
          }
          
          if (!["inactive", "active", "pending", "suspended"].includes(value)) {
            return res.status(400).json({ message: `Invalid status value for ${role}` });
          }
          
          updateData[`roleStatus.${role}`] = value;
        }
        
        // Recalculate overall status based on role statuses
        if (!status && roleStatus) {
          const updatedRoleStatus = { ...user.roleStatus.toObject(), ...roleStatus };
          const roleStatusValues = Object.values(updatedRoleStatus);
          
          // Determine overall status based on role statuses
          let calculatedStatus = "inactive";
          
          if (roleStatusValues.includes("active")) {
            calculatedStatus = "active";
          } else if (roleStatusValues.includes("pending")) {
            calculatedStatus = "pending";
          }
          
          // Only update overall status if not specifically provided
          updateData.status = calculatedStatus;
        }
      }
      
      // Update the user
      await User.updateOne({ userId }, { $set: updateData });
      
      // Get updated user for response
      const updatedUser = await User.findOne({ userId }).select("-password");
      
      return res.status(200).json({
        message: "User status updated successfully",
        user: updatedUser
      });
    } catch (error) {
      console.error("Error updating user status:", error.message);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
}

module.exports = UsersController;