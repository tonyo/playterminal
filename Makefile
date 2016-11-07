all:
	@echo 'Nothing to be done' && exit 1

clean:
	find . -name \*.pyc -delete
	find . -name \*.pyo -delete

test:
	py.test tests/
