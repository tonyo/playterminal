all:
	exit 1

update_prod_conf:
	ansible-playbook -i production full.yml  --diff -K --tags playterminal -e pt_update_repo=0 ${ARGS}

update_prod_app:
	ansible-playbook -i production full.yml  --diff -K --tags playterminal -e pt_deploy=1 ${ARGS}

