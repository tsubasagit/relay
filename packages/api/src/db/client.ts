import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { config } from "../config.js";
import * as schema from "./schema.js";

const sql = neon(config.databaseUrl);
export const db = drizzle(sql, { schema });
