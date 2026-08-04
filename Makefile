.PHONY: download dev test prod

VIDEOS := webapp/public/videos.json

download: ## scrape approved channels -> webapp/public/videos.json
	uv run --project scraper scraper/scrape.py --channels channels.json --out $(VIDEOS) --max-videos 50 $(SCRAPE_FLAGS)

$(VIDEOS):
	$(MAKE) download

dev: $(VIDEOS) ## local dev server (http://localhost:5173)
	cd webapp && npm install && npm run dev -- --host

test: ## test suite; also called in CI
	cd webapp && npm install && npm run test

prod: download ## used by gh-actions: package site for pathikrit.github.io/TinyTube
	cd webapp && npm ci
	$(MAKE) test
	cd webapp && npm run build
