export interface PadState {
  id: string;
  value: number;
  timeInterval: number;
  disabledDate?: Date;
}

export interface User {
  email: string;
  money: number;
  votes: number;
  username: string;
  isAdvancedUser: boolean;
  isSpinAvailable: boolean;
  padStates: PadState[];
  createdAt: string;
}

export type Bonus = "votes" | "credit" | "withdraw";
