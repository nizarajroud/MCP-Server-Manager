.PHONY: setup dev build test lint clean stop

setup:
	bash scripts/setup-local.sh

dev:
	./start-app.sh

stop:
	bash scripts/cleanup.sh

test-frontend:
	cd frontend && npx vitest run

test-backend:
	cd backend && npx jest

test: test-frontend test-backend

lint:
	cd frontend && npx eslint src/ --ext .js,.jsx

build:
	cd frontend && npx vite build

clean:
	bash scripts/cleanup.sh
	rm -f vite.log backend.log
