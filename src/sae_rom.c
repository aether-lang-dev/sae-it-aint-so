/* The C side of sae, kept to what has to be C: main() and the stdout handle
 * page output goes through. The engine (QuickJS) is contrib.quickjs's
 * aether_quickjs.c; everything else is Aether, in src/sae_host.ae. */
#include <stdio.h>

void *sae_stdout(void) { return stdout; }

int sae_main(const char *arg1, const char *arg2, const char *exe); /* src/sae_host.ae */

int main(int argc, char **argv)
{
    return sae_main(argc > 1 ? argv[1] : "", argc > 2 ? argv[2] : "", argv[0]);
}
