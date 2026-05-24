
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { initializeAuthStorage } from "./app/core/storage/authStorage";
import { initializePushNotifications } from "./app/pushNotifications";
import { initializeTheme } from "./app/theme";
import { initializeLanguage } from "./app/language";
import "./styles/index.css";

  async function bootstrap() {
    await initializeAuthStorage();
    await initializePushNotifications();
    initializeTheme();
    initializeLanguage();
    createRoot(document.getElementById("root")!).render(<App />);
  }

  void bootstrap();
  
