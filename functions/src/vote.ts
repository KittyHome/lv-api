import * as functions from "firebase-functions/v1";
import {FieldValue, getFirestore} from "firebase-admin/firestore";

import {PadState} from "./lib/types";

const db = getFirestore();

interface VoteData {
  animalId: string;
  padId: string;
  isUp: boolean;
}

export const processVote = functions.https.onCall(
  async (data: VoteData, context) => {
    const {animalId, padId, isUp} = data;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    const uid = context.auth.uid;

    if (!padId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with a 'padId'.",
      );
    }

    try {
      const userDocPromise = db.collection("users").doc(uid).get();
      const animalDocPromise = db.collection("animals").doc(animalId).get();

      const [userDoc, animalDoc] = await Promise.all([
        userDocPromise,
        animalDocPromise,
      ]);

      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
      }

      const userData = userDoc.data();
      if (!userData || !userData.padStates) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "User data is missing padStates.",
        );
      }

      const padState = userData.padStates.find(
        (pad: PadState) => pad.id === padId,
      );
      if (!padState) {
        throw new functions.https.HttpsError(
          "not-found",
          "Pad state with the given voteId not found.",
        );
      }

      const currentDate = new Date();
      if (
        padState.disabledDate &&
        new Date(padState.disabledDate) > currentDate
      ) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The pad state is currently disabled.",
        );
      }

      // Set the disabledDate of padState as currentDate + timeInterval
      // of padState
      const newDisabledDate = new Date(
        currentDate.getTime() + padState.timeInterval * 1000,
      );
      padState.disabledDate = newDisabledDate.toISOString();

      // Deduct votes by value of padState
      const voteDeficit = padState.value - userData.votes;
      if (voteDeficit > 0) {
        // Deduct remaining deficit from money
        const deductionAmount = 0.1 * voteDeficit;
        if (userData.money < deductionAmount) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "User does not have enough money to cover the vote deficit.",
          );
        }
        userData.money -= deductionAmount;
        userData.votes = 0;
      } else {
        userData.votes -= padState.value;
      }

      // Find animal which id is animalId and increase vote by value of padState
      if (!animalDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Animal not found.");
      }

      await db
        .collection("animals")
        .doc(animalId)
        .update({
          vote: FieldValue.increment(isUp ? padState.value : -padState.value),
        });

      // Update the user's padStates and money in the database
      await db.collection("users").doc(uid).update({
        padStates: userData.padStates,
        money: userData.money,
        votes: userData.votes,
      });
    } catch (error) {
      console.error("Error processing vote:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while processing the vote.",
      );
    }
  },
);
