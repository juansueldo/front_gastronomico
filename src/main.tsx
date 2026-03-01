
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { initializeAuthStorage } from "./app/authStorage";
  import { initializePushNotifications } from "./app/pushNotifications";
  import "./styles/index.css";

  async function bootstrap() {
    await initializeAuthStorage();
    await initializePushNotifications();
    createRoot(document.getElementById("root")!).render(<App />);
  }

  void bootstrap();
  