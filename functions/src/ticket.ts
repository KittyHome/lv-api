import {FieldValue, getFirestore} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

import {MAX_COUNT_OF_ACTIVE_TICKETS, PRICE_OF_TICKET} from "./lib/constants";
import {getNextTime} from "./lib/utils";

const db = getFirestore();

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

    const nextGameTimeId = nextGameTime
      .toISOString()
      .replace(/[-:]/g, "_")
      .split(".")[0];
    const userTicketRef = db
      .collection("tickets")
      .doc(nextGameTimeId)
      .collection(userId);

    const activeTicketsSnapshot = await userTicketRef.get();
    const activeTicketCount = activeTicketsSnapshot.size;

    if (activeTicketCount >= MAX_COUNT_OF_ACTIVE_TICKETS) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "You have reached the maximum number of active tickets.",
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
      // Add the ticket data to the user's subcollection in Firestore
      await userTicketRef.add(ticketData);

      // Deduct the ticket price from the user's balance
      await db
        .collection("users")
        .doc(userId)
        .update({
          money: FieldValue.increment(-PRICE_OF_TICKET),
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
