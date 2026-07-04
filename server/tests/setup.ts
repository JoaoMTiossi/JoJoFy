import dotenv from "dotenv";

dotenv.config();

import { jobRunner } from "../src/core/jobs/instance";
import { registerJobHandlers } from "../src/core/jobs/registerHandlers";

registerJobHandlers(jobRunner);
