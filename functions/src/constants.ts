import {User} from "./types";

export const initialUserData: Omit<User, "createdAt" | "email" | "username"> = {
  money: 0,
  votes: 100,
  isAdvancedUser: false,
  isSpinAvailable: true,
  padStates: [
    {
      id: "1",
      value: 1,
      timeInterval: 10,
    },
    {
      id: "10",
      value: 10,
      timeInterval: 90,
    },
    {
      id: "100",
      value: 100,
      timeInterval: 800,
    },
  ],
};

export const PRICE_OF_TICKET = 20;
