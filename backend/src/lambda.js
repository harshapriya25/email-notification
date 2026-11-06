
import serverlessExpress from "@codegenie/serverless-express";
import app from "./app.js";
import { connectDB } from "./config/db.js";

let serverlessHandler;

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectDB();

    if (!serverlessHandler) {
      serverlessHandler = serverlessExpress({ app });
    }

    return await serverlessHandler(event, context);
  } catch (error) {
    console.error("Lambda error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Internal server error."
      })
    };
  }
};
