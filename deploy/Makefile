all:
	exit 1

update_prod:
	ansible-playbook -i production full.yml  --diff -K --tags playterminal -e pt_deploy=1 ${ARGS}
