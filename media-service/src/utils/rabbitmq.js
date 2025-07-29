const amqp = require("amqplib");
const logger = require("./logger");

let connection = null;
let channel = null;

const EXCHANGE_NAME = "social_media_events";

async function connectToRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });
    logger.info("Connected to rabbitMQ");
    return channel;
  } catch (error) {
    logger.error("Error creating to rabbitMQ", error);
  }
}

async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectToRabbitMQ();
  }
  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message))
  );
  logger.info(`Event published: ${routingKey}`);
}

async function consumeEvent(routingKey, callBack) {
  if (!channel) {
    await connectToRabbitMQ();
  }
  const que = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(que.queue, EXCHANGE_NAME, routingKey);
  channel.consume(que.queue, (msg) => {
    const content = JSON.parse(msg.content.toString());
    callBack(content);
    channel.ack(msg);
  });
  logger.info(`Subscribed to event: ${routingKey}`);
}

module.exports = { connectToRabbitMQ, publishEvent, consumeEvent };
