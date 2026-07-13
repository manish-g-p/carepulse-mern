// Speech worker: the Phase 5 extraction of the heavy AI pipeline out of the
// API server. Consumes speech-processing jobs from RabbitMQ and runs
// decrypt -> whisper -> diarize -> save, so the API stays responsive and the
// CPU-hungry part can be scaled/restarted independently (run several workers
// for parallel throughput -- prefetch(1) makes the broker load-balance jobs).
//
// Run with: npm run worker   (requires RabbitMQ, e.g. via docker compose up)
require("dotenv").config();
const amqp = require("amqplib");
const connectDB = require("./config/db");
const { runSpeechProcessing } = require("./services/speechPipeline");
const { QUEUE, RABBITMQ_URL } = require("./services/speechQueue");

const RETRY_DELAY_MS = 5000;

const start = async () => {
  // Same database as the conversation service -- the worker writes the
  // transcripts that service owns.
  await connectDB(process.env.CONVERSATION_DB || "carepulse_conversations");

  const consume = async () => {
    try {
      const connection = await amqp.connect(RABBITMQ_URL);
      connection.on("close", () => {
        console.warn(`[worker] broker connection closed, retrying in ${RETRY_DELAY_MS / 1000}s`);
        setTimeout(consume, RETRY_DELAY_MS);
      });
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      channel.prefetch(1); // one job at a time per worker

      console.log(`[worker] consuming ${QUEUE} on ${RABBITMQ_URL}`);
      channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        const job = JSON.parse(msg.content.toString());
        console.log(`[worker] processing session ${job.sessionId}`);
        // runSpeechProcessing handles its own errors (marks the session
        // "failed"), so the job is always acked -- no poison-message loops.
        await runSpeechProcessing(job.sessionId, job.audioFilename, job.numSpeakers);
        console.log(`[worker] finished session ${job.sessionId}`);
        channel.ack(msg);
      });
    } catch (error) {
      console.warn(`[worker] broker unavailable (${error.message}), retrying in ${RETRY_DELAY_MS / 1000}s`);
      setTimeout(consume, RETRY_DELAY_MS);
    }
  };

  consume();
};

start();
