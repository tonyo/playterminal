# Based on v86's tools/docker/alpine/Dockerfile (at commit 315b2b0, the source of
# npm v86@0.5.473). Changes: games instead of nodejs, no networking script,
# a launcher instead of a login shell on ttyS0.
FROM docker.io/i386/alpine:3.21.0

ENV KERNEL=virt
ENV ADDPKGS="bsd-games nethack ncurses-terminfo-base"

RUN apk add openrc alpine-base agetty alpine-conf linux-$KERNEL linux-firmware-none $ADDPKGS

RUN sed -i 's/getty 38400 tty1/agetty --autologin root tty1 linux/' /etc/inittab
# ttyS0 carries the Games: the launcher reads "<rows> <cols> <command>" lines.
COPY --chmod=755 playterminal-launcher /usr/local/bin/playterminal-launcher
RUN echo 'ttyS0::respawn:/usr/local/bin/playterminal-launcher' >> /etc/inittab
RUN echo "root:" | chpasswd

RUN setup-hostname localhost

# https://wiki.alpinelinux.org/wiki/Alpine_Linux_in_a_chroot#Preparing_init_services
RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done
RUN for i in hwclock modules sysctl hostname syslog bootmisc; do rc-update add $i boot; done
RUN rc-update add killprocs shutdown

# Generate initramfs with 9p modules
RUN mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/$KERNEL/kernel.release)
