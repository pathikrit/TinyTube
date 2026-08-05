.PHONY: download dev test prod

VIDEOS := public/videos.json

download: ## fetch approved channels via YouTube Data API -> public/videos.json
	npm run download -- $(DOWNLOAD_FLAGS)

$(VIDEOS):
	$(MAKE) download

dev: $(VIDEOS) ## watch mode: vite dev server (http://localhost:5173) + vitest re-running on change
	npm install && npm run dev

test: ## test suite; also called in CI
	npm install && npm run test

prod: download ## used by gh-actions: package site for pathikrit.github.io/TinyTube
	npm ci
	$(MAKE) test
	npm run build
