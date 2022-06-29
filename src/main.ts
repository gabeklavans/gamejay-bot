// const pkg = require("correct-frequency-random-letters");
import "dotenv/config";
import startBot from "./bot";
import startServer from "./server/server";

startServer();

startBot();
