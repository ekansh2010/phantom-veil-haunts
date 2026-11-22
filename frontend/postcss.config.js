import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicit config path so builds work whether Vite runs from the repo root or frontend/.
export default {
  plugins: {
    tailwindcss: { config: path.resolve(__dirname, "tailwind.config.ts") },
    autoprefixer: {},
  },
};
