import * as functions from "firebase-functions/v1";
// import { getFirestore } from "firebase-admin/firestore";

// const db = getFirestore();

export const evaluateGame = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async () => {
    console.log("This will be run every hour!");
  });

export const resetFreeVotes = functions.pubsub
  .schedule("0 0 * * *")
  .onRun(async () => {
    console.log("This job runs every day at midnight!");
  });
