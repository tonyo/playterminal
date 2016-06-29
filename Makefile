all:
	@echo 'Nothing to be done' && exit 1

cleanup:
	./manage.py shell <scripts/cleanup.py
