## Firewall

This scripts manages an iptables-based firewall.

Actions:

* Enable the firewall:
    
    sudo ./firewall.sh enable
    
* Disable the firewall:

    sudo ./firewall.sh disable
    
The script is idempotent, so it is allowed to call 'enable' or 'disable' several
times in a row. The script will also report if there were any changes in the applied
configuration.
