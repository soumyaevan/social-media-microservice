require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const cors = require("cors");
const helmet = require("helmet");
const postRoutes = require("./routes/post-route");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { RedisStore } = require("rate-limit-redis");
const { rateLimit } = require("express-rate-limit");
const { connectToRabbitMQ } = require("./utils/rabbitmq");

const PORT = process.env.PORT || 3002;
const app = express();

// connect mongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Database is connected"))
  .catch((e) => logger.error("Database connection error", e));

const redisClient = new Redis(process.env.REDIS_URL);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body - ${req.body}`);
  next();
});

const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ success: false, message: "Too many requests" });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

// apply sensitive limiter to routes
app.use("/api/posts/create-post", sensitiveEndpointsLimiter);

// passing redis client to routes
app.use(
  "/api/posts",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  postRoutes
);

//error handler
app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();

    app.listen(PORT, () => {
      logger.info(`Post service is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}

startServer();

//unhandled promise rejection
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason:", reason);
});
