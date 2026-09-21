import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { adminRouter } from "./admin-routes";

export default function AdminApp() {
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
    <div className="relative w-full min-h-screen overflow-x-hidden bg-[#f0f4f8] dark:bg-[#121212] transition-colors duration-300">
      <div className="relative z-10 w-full min-h-screen">
        <RouterProvider router={adminRouter} />
      </div>
    </div>
  );
}
