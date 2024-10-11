import * as functions from "firebase-functions/v1";
import {getFirestore} from "firebase-admin/firestore";

import {generateRandomUsername} from "./utils";
import {initialUserData} from "./constants";

const db = getFirestore();

export const createUserRecord = functions.auth.user().onCreate((user) => {
  const userData = {
    email: user.email,
    createdAt: new Date().toISOString(),
    username: generateRandomUsername(),
    ...initialUserData,
  };

  return db
    .collection("users")
    .doc(user.uid)
    .set(userData)
    .then(() => console.log(`Created new user record for ${user.uid}`))
    .catch((error) => console.error("Error creating user record:", error));
});

interface UpdateUsernameData {
  newUsername: string;
}

export const updateUsername = functions.https.onCall(
  async (data: UpdateUsernameData, context) => {
    const {newUsername} = data;
    const uid = context.auth?.uid;

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated.",
      );
    }

    if (!uid || !newUsername) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with a 'newUsername'.",
      );
    }

    try {
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
      }

      const userData = userDoc.data();
      if (!userData || !userData.isAdvancedUser) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only advanced users can change their username.",
        );
      }

      await db.collection("users").doc(uid).update({username: newUsername});
      return {message: `Username updated successfully for user ${uid}`};
    } catch (error) {
      console.error("Error updating username:", error);
      throw new functions.https.HttpsError(
        "internal",
        "An error occurred while updating the username.",
      );
    }
  },
);
