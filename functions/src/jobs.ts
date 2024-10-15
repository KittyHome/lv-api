import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/scheduler";

const db = getFirestore();

export const evaluateGame = onSchedule("0 * * * *", async () => {
  const currentGameTime = new Date();
  currentGameTime.setHours(currentGameTime.getHours(), 0, 0, 0);

  const currentGameTimeId = currentGameTime
    .toISOString()
    .replace(/[-:]/g, "_")
    .split(".")[0];

  const resultDocRef = db.collection("results").doc(currentGameTimeId);
  const resultDoc = await resultDocRef.get();

  if (resultDoc.exists) {
    console.log(`Game with ID ${currentGameTimeId} is already checked out.`);
    return;
  }

  // Fetch the votes for each animal
  const animalsSnapshot = await db.collection("animals").get();
  const animalVotes: {id: string; vote: number}[] = [];

  animalsSnapshot.forEach((doc) => {
    const animalData = doc.data();
    animalVotes.push({id: doc.id, vote: animalData.vote || 0});
  });

  // Sort animals by votes in descending order
  animalVotes.sort((a, b) => {
    if (b.vote === a.vote) {
      return a.id.localeCompare(b.id);
    }
    return b.vote - a.vote;
  });

  // Calculate the prize pool
  const prizeDoc = await db.collection("variables").doc("prize").get();
  let transferredPrize = 0;

  if (prizeDoc.exists) {
    const prizeData = prizeDoc.data();
    if (prizeData && typeof prizeData.transferred === "number") {
      transferredPrize = prizeData.transferred;
    }
  }

  const ticketRef = db.collection("tickets").doc(currentGameTimeId);
  const subcollections = await ticketRef.listCollections();

  let firstGradeCount = 0;
  let secondGradeCount = 0;
  let thirdGradeCount = 0;
  let totalUserCount = 0;
  let totalTicketCount = 0;
  const userGrades: Record<string, ("Gold" | "Silver" | "Bronze")[]> = {};

  const currentAnimalOrder = animalVotes.map((animal) => animal.id);

  for (const subcollection of subcollections) {
    const userId = subcollection.id;
    const snapshot = await subcollection.get();
    totalUserCount++;

    userGrades[userId] = [];

    snapshot.forEach((doc) => {
      totalTicketCount++;
      const ticketData = doc.data();
      const predictedOrder = ticketData.orders
        .sort((a: {rank: number}, b: {rank: number}) => a.rank - b.rank)
        .map((order: {key: string}) => order.key);

      if (predictedOrder.join() === currentAnimalOrder.join()) {
        firstGradeCount++;
        userGrades[userId].push("Gold");
      } else if (
        predictedOrder.slice(0, 3).join() ===
        currentAnimalOrder.slice(0, 3).join()
      ) {
        secondGradeCount++;
        userGrades[userId].push("Silver");
      } else if (
        predictedOrder.slice(0, 2).join() ===
        currentAnimalOrder.slice(0, 2).join()
      ) {
        thirdGradeCount++;
        userGrades[userId].push("Bronze");
      }
    });
  }

  const prizePool = totalTicketCount * 20 + transferredPrize;

  const noFirstGrade = firstGradeCount === 0;
  const noSecondGrade = secondGradeCount === 0;
  const noThirdGrade = thirdGradeCount === 0;

  if (noFirstGrade) firstGradeCount = 1;
  if (noSecondGrade) secondGradeCount = 1;
  if (noThirdGrade) thirdGradeCount = 1;

  let prizeForGold = prizePool / (2 * firstGradeCount);
  firstGradeCount > 0 ? prizePool / (2 * firstGradeCount) : 0;
  let prizeForSilver =
    secondGradeCount > 0
      ? Math.min(prizePool / (3 * secondGradeCount), prizeForGold * 0.5)
      : 0;
  let prizeForBronze =
    thirdGradeCount > 0
      ? Math.min(prizePool / (6 * thirdGradeCount), prizeForSilver * 0.5)
      : 0;

  const fakePrize =
    prizeForGold * firstGradeCount +
    prizeForSilver * secondGradeCount +
    prizeForBronze * thirdGradeCount;

  if (fakePrize > 0) {
    prizeForGold = (prizePool / fakePrize) * prizeForGold;
    prizeForSilver = (prizePool / fakePrize) * prizeForSilver;
    prizeForBronze = (prizePool / fakePrize) * prizeForBronze;
  }

  const willTransferredPrize =
    prizePool -
    (prizeForGold * firstGradeCount +
      prizeForSilver * secondGradeCount +
      prizeForBronze * thirdGradeCount) +
    (noFirstGrade ? prizeForGold * firstGradeCount : 0) +
    (noSecondGrade ? prizeForSilver * secondGradeCount : 0) +
    (noThirdGrade ? prizeForBronze * thirdGradeCount : 0);

  // Update the transferred prize in the database
  try {
    await db.collection("variables").doc("prize").update({
      transferred: willTransferredPrize,
    });
  } catch (error) {
    console.error("Error updating transferred prize:", error);
  }

  for (const [userId, grades] of Object.entries(userGrades)) {
    let totalPrize = 0;

    grades.forEach((grade) => {
      if (grade === "Gold") {
        totalPrize += prizeForGold;
      } else if (grade === "Silver") {
        totalPrize += prizeForSilver;
      } else if (grade === "Bronze") {
        totalPrize += prizeForBronze;
      }
    });

    if (totalPrize > 0) {
      try {
        // Update the user's money with the total prize
        await db
          .collection("users")
          .doc(userId)
          .update({
            money: FieldValue.increment(totalPrize),
          });

        // Add to results collection
        const userResultRef = db
          .collection("results")
          .doc(currentGameTimeId)
          .collection(userId)
          .doc();

        await userResultRef.set({
          grade: grades,
          prize: totalPrize,
        });

        const notificationRef = db
          .collection("users")
          .doc(userId)
          .collection("notifications")
          .doc();

        await notificationRef.set({
          isRead: false,
          isNotified: false,
          createdAt: new Date(),
          content: `The game has ended. You have earned a total prize of $${totalPrize}.`,
        });
      } catch (error) {
        console.error(`Error updating user ${userId} money or results:`, error);
      }
    } else {
      const notificationRef = db
        .collection("users")
        .doc(userId)
        .collection("notifications")
        .doc();

      await notificationRef.set({
        isRead: false,
        isNotified: false,
        createdAt: new Date(),
        content: `The game has ended. Unfortunately, you did not earn any prize this time.`,
      });
    }
  }

  try {
    const resultsDocRef = db.collection("results").doc(currentGameTimeId);

    await resultsDocRef.set(
      {
        animalVotesOrder: animalVotes,
        totalUserCount,
        totalTicketCount,
        prizePool,
        firstGradeCount: noFirstGrade ? 0 : firstGradeCount,
        secondGradeCount: noSecondGrade ? 0 : secondGradeCount,
        thirdGradeCount: noThirdGrade ? 0 : thirdGradeCount,
      },
      {merge: true},
    );

    console.log(
      `Animal votes added to results for game time ID: ${currentGameTimeId}`,
    );
  } catch (updateError) {
    console.error(
      `Error updating results with animal votes for game time ID: ${currentGameTimeId}`,
      updateError,
    );
  }

  try {
    const animalsSnapshot = await db.collection("animals").get();

    const batch = db.batch();
    animalsSnapshot.forEach((doc) => {
      const animalRef = db.collection("animals").doc(doc.id);
      batch.update(animalRef, {vote: 0});
    });

    await batch.commit();
    console.log("Animal votes have been reset.");
  } catch (resetError) {
    console.error("Error resetting animal votes:", resetError);
  }
});

export const resetFreeVotes = onSchedule("0 0 * * *", async () => {
  console.log("This job runs every day at midnight!");
});

export const updateTrends = onSchedule("* * * * *", async () => {
  // Update the trends about current moment
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const hour = String(currentDate.getHours()).padStart(2, "0");

  // Calculate the next closest 5-minute interval
  const currentMinutes = currentDate.getMinutes();
  const nextInterval = Math.ceil(currentMinutes / 5) * 5;
  const minutes = String(nextInterval).padStart(2, "0");

  const currentTimeId = `${year}_${month}_${day}_${hour}_${minutes}`;

  const trendsRef = db.collection("variables").doc("trends");
  const trendsDoc = await trendsRef.get();

  const animalsSnapshot = await db.collection("animals").get();
  const animalVotes: Record<string, number> = {};

  animalsSnapshot.forEach((doc) => {
    const animalData = doc.data();
    animalVotes[doc.id] = animalData.vote || 0;
  });

  const trendsData = trendsDoc.exists ? (trendsDoc.data() ?? {}) : {};
  trendsData[currentTimeId] = animalVotes;

  await trendsRef.set(trendsData, {merge: true});

  console.log("Trends updated for:", currentTimeId);
});
