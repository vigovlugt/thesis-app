import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import pluginRewriteAll from "vite-plugin-rewrite-all";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tsconfigPaths(), pluginRewriteAll()],
    resolve: {
        alias: {
            stream: "stream-browserify",
        },
    },
});