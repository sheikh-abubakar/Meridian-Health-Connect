import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "@/context/AuthContext";
import { RealtimeProvider } from "@/realtime/RealtimeProvider";
import "./index.css";

createRoot(document.getElementById("root")).render(<StrictMode><BrowserRouter><AuthProvider><RealtimeProvider><App /></RealtimeProvider></AuthProvider></BrowserRouter></StrictMode>);
