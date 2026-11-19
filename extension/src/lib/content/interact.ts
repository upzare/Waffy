import { CURSOR_URL } from "@/config";
import { DOM_ACTIONS } from "@/lib/helper";
import { sleep } from "../utils";
import { hideAutomationOverlay, showAutomationOverlay } from "./automation-overlay";

const getOption = () => {
  const element = document.activeElement as HTMLSelectElement;
  if (element && element.tagName.toLowerCase() === "select") {
    const options = Array.from(element.options).map((option) => option.value);
    const optionsMessage = "Available options -> " + options.join(", ");
    return Promise.resolve({ status: "success", value: optionsMessage });
  }
  return Promise.resolve({ status: "error", value: "Element is not a select element" });
};

const setOption = (value: string) => {
  const element = document.activeElement as HTMLSelectElement;
  if (element && element.tagName.toLowerCase() === "select") {
    const options = Array.from(element.options).map((option) => option.value);
    if (options.includes(value)) {
      element.value = value;
      return Promise.resolve({ status: "success", value: "Value set successfully" });
    }
    return Promise.resolve({ status: "error", value: "Value not found" });
  }
  return Promise.resolve({ status: "error", value: "Element is not a select element" });
};

const createPointer = (x?: number, y?: number) => {
  const pointer = document.createElement("img");
  pointer.id = "waffy-pointer";
  pointer.src = CURSOR_URL;
  pointer.style.position = "fixed";
  pointer.style.left = `${x}px`;
  pointer.style.top = `${y}px`;
  pointer.style.width = "32px";
  pointer.style.height = "32px";
  pointer.style.zIndex = "999999";
  pointer.style.pointerEvents = "none";
  document.body.appendChild(pointer);
  return pointer;
};

const displayPointer = async (args: { x?: number; y?: number; timeout?: number }) => {
  const { x, y, timeout } = args;
  const pointer = createPointer(x, y);
  await sleep(timeout || 1500);
  pointer.remove();
  return { status: "success", value: "Pointer displayed" };
};

const animatePointer = async (args: {
  path?: Array<{ x: number; y: number }>;
  duration?: number;
}) => {
  const { path, duration } = args;
  if (!path?.length) {
    return { status: "error", value: "No path provided" };
  }
  const pointer = createPointer(path[0].x, path[0].y);
  const stepDelay = Math.max(1, (duration || path.length * 12) / path.length);
  for (const point of path) {
    pointer.style.left = `${point.x}px`;
    pointer.style.top = `${point.y}px`;
    await sleep(stepDelay);
  }
  await sleep(300);
  pointer.remove();
  return { status: "success", value: "Pointer animated" };
};

export const interactDom = (name: string, args: Record<string, any> = {}) => {
  switch (name) {
    case DOM_ACTIONS.getOption:
      return getOption();
    case DOM_ACTIONS.setOption:
      return setOption(args.value);
    case DOM_ACTIONS.displayPointer:
      return displayPointer(args);
    case DOM_ACTIONS.animatePointer:
      return animatePointer(args);
    case DOM_ACTIONS.showAutomationOverlay:
      return showAutomationOverlay();
    case DOM_ACTIONS.hideAutomationOverlay:
      return hideAutomationOverlay();
    default:
      return Promise.resolve({ status: "error", value: "Invalid function name" });
  }
};
