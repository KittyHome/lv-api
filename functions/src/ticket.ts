import {getFirestore} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

import {PRICE_OF_TICKET} from "./constants";

const db = getFirestore();

const getNextTime = () => {
  const currentDate = new Date();
  const nextHour = new Date(currentDate);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(currentDate.getHours() + 1);

  return nextHour;
};

interface TicketData {
  order: {key: string; rank: number}[];
}

export const createTicket = functions.https.onCall(
  async (data: TicketData, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    if (!data.order || !Array.isArray(data.order) || data.order.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with a non-empty 'order' array.",
      );
    }

    const currentDate = new Date();
    const nextGameTime = getNextTime();

    const timeDifference = nextGameTime.getTime() - currentDate.getTime();
    const thirtyMinutesInMillis = 30 * 60 * 1000;

    if (timeDifference < thirtyMinutesInMillis) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The next game time is less than 30 minutes away from the current " +
          "time.",
      );
    }

    const userId = context.auth.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found.");
    }

    const userData = userDoc.data();
    if (!userData || userData.money < PRICE_OF_TICKET) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Insufficient funds to purchase the ticket.",
      );
    }

    const orders = data.order;
    const createdAt = new Date().toISOString();

    const ticketData = {
      userId,
      orders,
      createdAt,
    };

    try {
      const nextGameTimeId = nextGameTime
        .toISOString()
        .replace(/[-:]/g, "_")
        .split(".")[0];
      const ticketRef = db.collection("tickets").doc(nextGameTimeId);
      const userTicketRef = ticketRef.collection(userId);

      const ticketDoc = await ticketRef.get();
      if (!ticketDoc.exists) {
        await ticketRef.set({});
      }

      // Add the ticket data to the user's subcollection in Firestore
      await userTicketRef.add(ticketData);

      // Deduct the ticket price from the user's balance
      await db
        .collection("users")
        .doc(userId)
        .update({
          money: userData.money - PRICE_OF_TICKET,
        });
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while creating the ticket.",
      );
    }
  },
);

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

  const prizeDoc = await db.collection("tickets").doc("prize").get();
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
