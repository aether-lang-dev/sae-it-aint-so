/* The C side of sae, kept to what has to be C: the stdout handle page output
 * goes through. main() is Aether's (src/sae_host.ae), so a library build of
 * sae (--emit=lib, as Android's activity loads it) runs the same entry. The
 * engine (QuickJS) is contrib.quickjs's aether_quickjs.c; everything else is
 * Aether, in src/sae_host.ae. */
#include <stdio.h>

void *sae_stdout(void) { return stdout; }
