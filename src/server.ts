import Fastify from "fastify";
import * as who from "./word-hunt/main.js";
const fastify = Fastify({
	logger: true,
});

fastify.get("/", (req, res) => {
	res.send({ hello: "world" });
});

export default async function startServer() {
	await who.init()

	fastify.listen(3000, (err, address) => {
		if (err) {
			fastify.log.error(err);
			process.exit(1);
		}
		fastify.log.info(`Server is now listening on ${address}`);
	});
}
