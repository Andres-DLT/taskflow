# Atajos para el día a día (Linux, macOS o WSL/Git Bash en Windows).
.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help install lint test test-integration build up down logs smoke e2e demo clean tf-fmt tf-validate

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Instala dependencias de backend y frontend
	cd backend && npm ci
	cd frontend && npm ci

lint: ## Lint de todo el código
	cd backend && npm run lint
	cd frontend && npm run lint

test: ## Tests unitarios
	cd backend && npm test
	cd frontend && npm test

test-integration: ## Tests de integración contra el PostgreSQL de docker compose
	docker compose up -d --wait db
	cd backend && DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow npm test

build: ## Construye las imágenes Docker
	docker compose build

up: ## Levanta el stack completo en http://localhost:8080
	docker compose up -d --build proxy

down: ## Para el stack (conserva datos)
	docker compose down

logs: ## Sigue los logs del stack
	docker compose logs -f --tail=100

smoke: ## Smoke tests contra el stack local
	bash deploy/scripts/smoke-test.sh http://localhost:8080

e2e: up smoke ## Levanta el stack y ejecuta los smoke tests

demo: ## Levanta el stack con las imágenes publicadas por el pipeline (IMAGE_TAG=main por defecto)
	docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --no-build proxy

clean: ## Para el stack y borra volúmenes
	docker compose down -v --remove-orphans

tf-fmt: ## Formatea Terraform
	terraform -chdir=infra/terraform fmt -recursive

tf-validate: ## Valida Terraform sin backend
	terraform -chdir=infra/terraform init -backend=false && terraform -chdir=infra/terraform validate
