import {Bonus} from "./types";

/**
 * Generates a random username by combining a random adjective,
 * a random animal name, and a random number.
 * @return {string} The generated username.
 */
export function generateRandomUsername() {
  const adjectives = [
    "Swift",
    "Clever",
    "Brave",
    "Mighty",
    "Wise",
    "Fierce",
    "Gentle",
    "Bold",
    "Noble",
    "Loyal",
  ];
  const animals = [
    "Lion",
    "Eagle",
    "Shark",
    "Wolf",
    "Falcon",
    "Tiger",
    "Bear",
    "Panther",
    "Hawk",
    "Leopard",
  ];
  const randomAdjective =
    adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  return `${randomAdjective}${randomAnimal}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Generates a random spin data object containing a bonus type and an amount.
 * The bonus type is randomly selected from a predefined list of types,
 * and the amount is a random number between 10 and 100.
 * @return {object} An object with a 'type' and 'amount' property.
 */
export function generateRandomSpinData(): {type: Bonus; amount: number} {
  const bonusTypes: Bonus[] = ["withdraw", "credit", "votes"];
  const type = bonusTypes[Math.floor(Math.random() * bonusTypes.length)];
  const amount = Math.floor(Math.random() * 91) + 10;
  return {type, amount};
}
