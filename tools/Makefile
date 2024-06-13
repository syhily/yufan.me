help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} \
		/^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

clean: ## Clean up build files.
	rm -rf tools

deps: ## Update vendor.
	go mod verify
	go mod tidy -v
	go get -u ./...

build: ## Build executable files
	go build -o tools main.go
