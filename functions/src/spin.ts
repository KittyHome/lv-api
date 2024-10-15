import {FieldValue, getFirestore} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

import {User} from "./lib/types";
import {generateRandomSpinData} from "./lib/utils";

const db = getFirestore();

export const getSpinData = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const userId = context.auth.uid;

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User not found.");
  }

  const userData = userDoc.data() as User;
  if (!userData || !userData.isSpinAvailable) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Spin is not available for the user.",
    );
  }

  const spinItems = Array.from({length: 16}, generateRandomSpinData);

  return {spinItems};
});

export const getTargetIndex = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const userId = context.auth.uid;

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User not found.");
  }

  const userData = userDoc.data() as User;
  if (!userData || !userData.isSpinAvailable) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Spin is not available for the user.",
    );
  }

  const {spinItems} = data;
  if (!Array.isArray(spinItems) || spinItems.length !== 16) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "spinItems must be an array of 16 items.",
    );
  }

  await db.collection("users").doc(userId).update({
    isSpinAvailable: false,
  });

  const targetIndex = Math.floor(Math.random() * spinItems.length);

  setTimeout(async () => {
    if (spinItems[targetIndex].type === "withdraw") {
      await db
        .collection("users")
        .doc(userId)
        .update({
          withdrawChance: FieldValue.increment(spinItems[targetIndex].amount),
        });
    } else if (spinItems[targetIndex].type === "credit") {
      await db
        .collection("users")
        .doc(userId)
        .update({
          money: FieldValue.increment(spinItems[targetIndex].amount),
        });
    } else if (spinItems[targetIndex].type === "votes") {
      await db
        .collection("users")
        .doc(userId)
        .update({
          votes: FieldValue.increment(spinItems[targetIndex].amount),
        });
    }
  }, 3000);

  return {targetIndex};
});
