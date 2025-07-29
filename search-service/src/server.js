require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const searchRoutes = require("./routes/search-route");
const {
  handlePostCreated,
  handlePostDeleted,
} = require("./evenntHandlers/search-event-handlers");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

const PORT = process.env.PORT || 3004;
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
app.use("/api/search/posts", sensitiveEndpointsLimiter);

app.use(
  "/api/search",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  searchRoutes
);

//error handler
app.use(errorHandler);

async function startServer(params) {
  try {
    await connectToRabbitMQ();
    //consume all events
    await consumeEvent("post.created", (event) =>
      handlePostCreated(event, redisClient)
    );
    await consumeEvent("post.deleted", (event) =>
      handlePostDeleted(event, redisClient)
    );
    app.listen(PORT, () => {
      logger.info(`Search service is running on port ${PORT}`);
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
