import { createCLI } from "../src/cli.js";
import { checkForUpdate } from "../src/update-notifier.js";

const program = createCLI();
await program.parseAsync(process.argv);
checkForUpdate();
