# Run from the repository root:
#   docker buildx bake          the image, tonyo/playterminal
#   docker buildx bake vm-out   only the verified VM files, into vm/out (`mise run vm:build`)

group "default" {
  targets = ["playterminal"]
}

# The i386 VM Image. Dockerfile's vm-image stage reads its files as the `guest` context.
target "guest" {
  context   = "vm/image"
  platforms = ["linux/386"]
}

target "_with-guest" {
  context  = "."
  contexts = { guest = "target:guest" }
}

target "playterminal" {
  inherits = ["_with-guest"]
  tags     = ["tonyo/playterminal"]
}

target "vm-out" {
  inherits = ["_with-guest"]
  target   = "vm-out"
  output   = ["type=local,dest=vm/out"]
}
