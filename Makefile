# gameWE web - build and package the standalone server.

# Version: a v* git tag on HEAD, otherwise the VERSION file.
VERSION ?= $(shell git describe --tags --exact-match --match 'v*' 2>/dev/null | sed 's/^v//' || true)
ifeq ($(VERSION),)
VERSION := $(shell cat VERSION)
endif
ARCH    := linux-amd64
PKG     := gamewe-web-$(VERSION)-$(ARCH)
IMAGE   ?= gamewe-web

.PHONY: build package image clean

build:
	npm ci
	npm run build

# dist/gamewe-web-<version>-linux-amd64.tar.gz unpacks to /opt/gamewe/web and the systemd unit.
# Built with a placeholder sub path; the unit applies BASE_PATH from web.env at start.
package: export BASE_PATH = /__gamewe_base__
package: build
	rm -rf dist/root && mkdir -p dist/root/opt/gamewe/web dist/root/etc/systemd/system dist/root/etc/gamewe/web
	cp -r .next/standalone/. dist/root/opt/gamewe/web/
	mkdir -p dist/root/opt/gamewe/web/.next dist/root/opt/gamewe/web/public
	cp -r .next/static dist/root/opt/gamewe/web/.next/static
	cp -r public/. dist/root/opt/gamewe/web/public/
	cp -r scripts dist/root/opt/gamewe/web/scripts
	cp -r templates dist/root/opt/gamewe/web/templates
	cp LICENSE THIRD-PARTY-LICENSES.md dist/root/opt/gamewe/web/
	rm -f dist/root/opt/gamewe/web/.env dist/root/opt/gamewe/web/.env.local
	cp packaging/gamewe-web.service dist/root/etc/systemd/system/
	cp .env.example dist/root/etc/gamewe/web/web.env
	tar -C dist/root --owner=0 --group=0 -czf dist/$(PKG).tar.gz .
	cd dist && sha256sum $(PKG).tar.gz > $(PKG).tar.gz.sha256

# Local container image, tagged with the version.
image:
	docker build --build-arg VERSION=$(VERSION) -t $(IMAGE):$(VERSION) .

clean:
	rm -rf .next dist
