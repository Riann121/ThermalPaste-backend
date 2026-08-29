// Colored server loggers for lifecycle messages.
import colors from "colors";

export const info = (msg) => console.log(colors.cyan(`[INFO]  ${msg}`));
export const success = (msg) => console.log(colors.bgGreen.black(`[OK]    ${msg}`));
export const warn = (msg) => console.log(colors.yellow(`[WARN]  ${msg}`));
export const error = (msg) => console.log(colors.red(`[ERROR] ${msg}`));
