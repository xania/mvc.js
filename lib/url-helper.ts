import { Route } from "./action.js";

export interface Link {
  route(): Route;
  toString(): string;
  go(): any;
  relative(...route: Route): Link;
}
