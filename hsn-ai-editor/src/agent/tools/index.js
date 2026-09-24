import { ToolRegistry } from "../registry.js";
import { perceptionTools } from "./perception.js";
import { planningTools } from "./planning.js";
import { editingTools } from "./editing.js";
import { deliveryTools } from "./delivery.js";

/** All tools. New capabilities are added by registering more tool defs. */
export function createRegistry(extra = []) {
  return new ToolRegistry().register(perceptionTools, planningTools, editingTools, deliveryTools, extra);
}
