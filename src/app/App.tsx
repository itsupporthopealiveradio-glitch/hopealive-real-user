import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { IOSInstallPrompt } from "./components/IOSInstallPrompt";

export default function App() {
  // Apply dark mode class to <html> on mount based on saved preference
  useEffect(() => {
    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-x-hidden bg-[#eef2f6] dark:bg-[#0b1018] transition-colors duration-300">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-[#feac22]/10 blur-3xl" />
        <div className="absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-[#0f766e]/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(15,23,42,1)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,1)_1px,transparent_1px)] [background-size:32px_32px] dark:opacity-[0.06]" />
      </div>
      <div className="relative z-10 w-full min-h-screen">
        <RouterProvider router={router} />
        <IOSInstallPrompt />
      </div>
    </div>
  );
}
