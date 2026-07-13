const amqp = require("amqplib");

// Publishes speech-processing jobs to RabbitMQ for the dedicated worker
// (worker.js). If the broker is unreachable, the caller falls back to running
// the pipeline in-process -- the app must keep working without the broker,
// both for dev convenience and so a broker outage degrades performance
// (API does the heavy work itself) rather than dropping transcripts.
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
const QUEUE = "speech-jobs";

let channelPromise = null;

const getChannel = () => {
  if (!channelPromise) {
    channelPromise = (async () => {
      const connection = await amqp.connect(RABBITMQ_URL);
      connection.on("error", () => (channelPromise = null));
      connection.on("close", () => (channelPromise = null));
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      return channel;
    })();
    channelPromise.catch(() => (channelPromise = null));
  }
  return channelPromise;
};

// Returns true if the job was handed to the broker, false if the caller
// should process it in-process instead.
const publishSpeechJob = async (job) => {
  try {
    const channel = await getChannel();
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(job)), { persistent: true });
    return true;
  } catch (error) {
    console.warn("RabbitMQ unavailable, falling back to in-process speech processing:", error.message);
    return false;
  }
};

module.exports = { publishSpeechJob, QUEUE, RABBITMQ_URL };
