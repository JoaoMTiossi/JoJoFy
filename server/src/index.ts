import "dotenv/config";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT) || 3333;

buildApp()
  .then((app) => app.listen({ port, host: "0.0.0.0" }))
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`JoJoFy server listening on port ${port}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
