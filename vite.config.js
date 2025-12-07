import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
	plugins: [solidPlugin()],
	server: {
		port: 3000,
		host: '0.0.0.0', // 👈 permette accesso da altri device sulla rete
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("pdfjs-dist")) {
						return "pdfjs";
					}
				},
			},
		},
	},
});
