/**
 * OmniLearn Agent
 * Copyright (c) 2026 Emmanuel Nenpan Hosea
 * Licensed under the AGPL v3 License
 */

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(<App />);
