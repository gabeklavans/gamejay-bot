import Fastify from "fastify";
import who from "./word-hunt/main";
const fastify = Fastify({
	logger: true,
});

fastify.get("/", (req, res) => {
	res.send({ hello: "world" });
});

fastify.get("/board", async (req, res) => {
	const rhetBoard = await who.getBoardWithSolutions();
	res.send(rhetBoard);
});

export default async function startServer() {
	await who.init();

	fastify.listen(3000, (err) => {
		if (err) {
			fastify.log.error(err);
			process.exit(1);
		}
	});
}
