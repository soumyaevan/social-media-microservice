const RefreshToken = require("../models/RefreshToken");
const User = require("../models/User");
const generateTokens = require("../utils/generateToken");
const logger = require("../utils/logger");
const { validateRegistration, validateLogin } = require("../utils/validation");

const registerUser = async (req, res) => {
  logger.info("Registration endpoint triggered");
  try {
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { username, email, password } = req.body;
    let user = await User.findOne({ $or: [{ username }, { email }] });
    if (user) {
      logger.warn("User already exists!!!");
      return res.status(400).json({
        success: false,
        message: "User already exists!!!",
      });
    }

    user = new User({ username, email, password });
    await user.save();
    logger.info("User is created successfully", user._id);

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({
      success: true,
      message: "User registration is successful",
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Registration error", error);
    let message = "Internal server error";
    if (error.details && error.details[0] && error.details[0].message) {
      message = error.details[0].message;
    } else if (error.message) {
      message = error.message;
    }
    return res.status(500).json({
      success: false,
      message,
    });
  }
};

// user login
const loginUser = async (req, res) => {
  logger.info("Login endpoint triggered");
  try {
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn("Invalid User!!!");
      return res.status(400).json({
        success: false,
        message: "Invalid Credentials!!!",
      });
    }
    // validate password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      logger.warn("Invalid Password!!!");
      return res.status(400).json({
        success: false,
        message: "Invalid Credentials!!!",
      });
    }
    //token
    const { accessToken, refreshToken } = await generateTokens(user);
    res.json({
      accessToken,
      refreshToken,
      userId: user._id,
    });
  } catch (error) {
    logger.error("Login error", error);
    let message = "Internal server error";
    if (error.details && error.details[0] && error.details[0].message) {
      message = error.details[0].message;
    } else if (error.message) {
      message = error.message;
    }
    return res.status(500).json({
      success: false,
      message,
    });
  }
};

// refresh token
const userRefreshToken = async (req, res) => {
  logger.info("refresh token endpoint triggered");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token is missing!!!");
      return res.status(400).json({
        success: false,
        message: "Refresh token is missing!!!",
      });
    }
    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn("Invalid or expired refresh token!!!");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired refresh token!!!",
      });
    }
    const user = await User.findById(storedToken.user);
    if (!user) {
      logger.warn("User is not found!!!");
      return res.status(400).json({
        success: false,
        message: "User is not found!!!",
      });
    }
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(user);

    // delete old refreshToken
    await RefreshToken.deleteOne({ _id: storedToken._id });

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error("Refresh token error", error);
    let message = "Internal server error";
    if (error.details && error.details[0] && error.details[0].message) {
      message = error.details[0].message;
    } else if (error.message) {
      message = error.message;
    }
    return res.status(500).json({
      success: false,
      message,
    });
  }
};

//logout
const userLogout = async (req, res) => {
  logger.info("logout endpoint triggered");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token is missing!!!");
      return res.status(400).json({
        success: false,
        message: "Refresh token is missing!!!",
      });
    }
    await RefreshToken.deleteOne({ token: refreshToken });
    logger.info("Refresh token is deleted for logout");
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout error", error);
    let message = "Internal server error";
    if (error.details && error.details[0] && error.details[0].message) {
      message = error.details[0].message;
    } else if (error.message) {
      message = error.message;
    }
    return res.status(500).json({
      success: false,
      message,
    });
  }
};

module.exports = { registerUser, loginUser, userRefreshToken, userLogout };
