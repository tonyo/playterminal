# Based on v86's tools/docker/alpine/Dockerfile (at commit 315b2b0, the source of
# npm v86@0.5.473). Changes: games instead of nodejs, no networking script,
# a launcher instead of a login shell on ttyS0.

# Greed is not packaged for Alpine: build ESR's last C release, 4.5 (5.x is a Rust
# rewrite), in its own stage and copy only the binary into the VM Image.
FROM docker.io/i386/alpine:3.21.0 AS greed
ARG GREED_COMMIT=79799d1ba4b1bbc30c13d2b6725ab5ce5dbc5c32
RUN apk add build-base ncurses-dev git
RUN git clone --depth 1 --branch 4.5 https://gitlab.com/esr/greed.git /src \
    && test "$(git -C /src rev-parse HEAD)" = "$GREED_COMMIT" \
    && make -C /src greed

FROM docker.io/i386/alpine:3.21.0

ENV KERNEL=virt
# bsd-games: robots and hangman; words-en: hangman's word list; micro-tetris: tetris.
ENV ADDPKGS="bsd-games nethack micro-tetris words-en ncurses-libs ncurses-terminfo-base"

RUN apk add openrc alpine-base agetty alpine-conf linux-$KERNEL linux-firmware-none $ADDPKGS
COPY --from=greed /src/greed /usr/bin/greed
COPY --from=greed /src/COPYING /usr/share/licenses/greed/COPYING

RUN sed -i 's/getty 38400 tty1/agetty --autologin root tty1 linux/' /etc/inittab
# ttyS0 carries the Games: the launcher reads "<rows> <cols> <command>" lines.
COPY --chmod=755 playterminal-launcher /usr/local/bin/playterminal-launcher
RUN echo 'ttyS0::respawn:/usr/local/bin/playterminal-launcher' >> /etc/inittab
# ttyS1 resizes ttyS0: playterminal-resize reads "<rows> <cols>" lines.
COPY --chmod=755 playterminal-resize /usr/local/bin/playterminal-resize
RUN echo 'ttyS1::respawn:/usr/local/bin/playterminal-resize' >> /etc/inittab
RUN echo "root:" | chpasswd

RUN setup-hostname localhost

# https://wiki.alpinelinux.org/wiki/Alpine_Linux_in_a_chroot#Preparing_init_services
RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done
RUN for i in hwclock modules sysctl hostname syslog bootmisc; do rc-update add $i boot; done
RUN rc-update add killprocs shutdown

# Generate initramfs with 9p modules
RUN mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/$KERNEL/kernel.release)
