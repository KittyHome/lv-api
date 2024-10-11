import * as admin from "firebase-admin";
admin.initializeApp();

import {createUserRecord, updateUsername} from "./auth";
import {processVote} from "./vote";
import {createTicket, getCurrentPrizePool, getNextGameTime} from "./ticket";
import {evaluateGame, resetFreeVotes} from "./jobs";
import {getSpinData, getTargetIndex} from "./spin";

export {
  createUserRecord,
  updateUsername,
  processVote,
  createTicket,
  getNextGameTime,
  evaluateGame,
  resetFreeVotes,
  getSpinData,
  getTargetIndex,
  getCurrentPrizePool,
};
