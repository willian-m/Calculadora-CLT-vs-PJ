PORT ?= 8888

.PHONY: serve test help

help:
	@echo "make serve   - serve a página estática em http://localhost:$(PORT)"
	@echo "make test    - roda as asserções do núcleo de cálculo (node)"

serve:
	@echo "Servindo em http://localhost:$(PORT)  (Ctrl+C para parar)"
	@python3 -m http.server $(PORT)

test:
	@node tests.js
