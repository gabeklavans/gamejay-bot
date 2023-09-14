import "dotenv/config";
import startBot from "./bot";
import startServer from "./server/server";

startServer();

startBot();
