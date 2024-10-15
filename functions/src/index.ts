import * as admin from "firebase-admin";
admin.initializeApp();

import {createUserRecord, updateUsername} from "./auth";
import {processVote} from "./vote";
import {createTicket} from "./ticket";
import {evaluateGame, resetFreeVotes, updateTrends} from "./jobs";
import {getSpinData, getTargetIndex} from "./spin";
import {getCurrentPrizePool, getNextGameTime, getTrends} from "./public";

export {
  createUserRecord,
  updateUsername,
  processVote,
  createTicket,
  getSpinData,
  getTargetIndex,
  getNextGameTime,
  getCurrentPrizePool,
  getTrends,
  updateTrends,
  evaluateGame,
  resetFreeVotes,
};
