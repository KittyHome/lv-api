import {getFirestore} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

import {getNextTime} from "./lib/utils";
import {PRICE_OF_TICKET} from "./lib/constants";

const db = getFirestore();

export const getNextGameTime = functions.https.onCall(async () => {
  const nextGameTime = getNextTime().toISOString();
  return {nextGameTime};
});

export const getCurrentPrizePool = functions.https.onCall(async () => {
  const nextGameTime = getNextTime();
  const nextGameTimeId = nextGameTime
    .toISOString()
    .replace(/[-:]/g, "_")
    .split(".")[0];

  const prizeDoc = await db.collection("variables").doc("prize").get();
  let transferredPrize = 0;

  if (prizeDoc.exists) {
    const prizeData = prizeDoc.data();
    if (prizeData && typeof prizeData.transferred === "number") {
      transferredPrize = prizeData.transferred;
    }
  }

  const ticketRef = db.collection("tickets").doc(nextGameTimeId);
  const subcollections = await ticketRef.listCollections();
  let totalDocumentCount = 0;

  for (const subcollection of subcollections) {
    const snapshot = await subcollection.get();
    totalDocumentCount += snapshot.size;
  }

  return {prizePool: totalDocumentCount * PRICE_OF_TICKET + transferredPrize};
});

export const getTrends = functions.https.onCall(async () => {
  const trendsRef = db.collection("variables").doc("trends");
  const trendsDoc = await trendsRef.get();
  const trendsData = trendsDoc.data();

  if (!trendsData) {
    return {};
  }

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const hour = String(currentDate.getHours()).padStart(2, "0");

  const currentPrefix = `${year}_${month}_${day}_${hour}`;

  const filteredTrends = Object.keys(trendsData)
    .filter((key) => key.startsWith(currentPrefix))
    .reduce(
      (obj, key) => {
        const minute = parseInt(key.slice(-2), 10);
        const percentage = `${((minute / 60) * 100).toFixed(0)}`.padStart(
          2,
          "0",
        );
        obj[`${percentage}%`] = trendsData[key];
        return obj;
      },
      {} as Record<string, Record<string, number>>,
    );

  return filteredTrends;
});
