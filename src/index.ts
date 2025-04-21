import { setFailed } from "@actions/core";
import { run } from "./main";

if (!process.env.JEST_WORKER_ID) {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      setFailed(error.message);
    } else {
      setFailed("Unknown error");
    }
  }
}
