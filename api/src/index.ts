import { createApp } from "./app";
import { config } from "./shared/config";

const app = createApp();
app.listen(config.port, () => {
  console.log(`EduQuest API en puerto ${config.port}`);
});