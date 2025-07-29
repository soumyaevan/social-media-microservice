const amqp = require("amqplib");
const logger = require("./logger");

let connection = null;
let channel = null;

const EXCHANGE_NAME = "social_media_events";

// async function connectToRabbitMQ() {
//   try {
//     connection = await amqp.connect(process.env.RABBITMQ_URL);
//     channel = await connection.createChannel();
//     await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });
//     logger.info("Connected to rabbitMQ");
//     return channel;
//   } catch (error) {
//     logger.error("Error creating to rabbitMQ", error);
//   }
// }
async function connectToRabbitMQ(retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });
      logger.info("Connected to rabbitMQ");
      return channel;
    } catch (error) {
      logger.error(
        `RabbitMQ connection failed (attempt ${i + 1}): ${error.message}`
      );
      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, delay));
      } else {
        throw new Error("All RabbitMQ connection attempts failed.");
      }
    }
  }
}
async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectToRabbitMQ();
  }
  if (!channel) {
    throw new Error("RabbitMQ channel is not available.");
  }
  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message))
  );
  logger.info(`Event published: ${routingKey}`);
}

module.exports = { connectToRabbitMQ, publishEvent };
