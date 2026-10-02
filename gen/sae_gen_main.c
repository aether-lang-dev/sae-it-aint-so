/* Entry for sae's stdlib-ROM generator. The spec is gen/sae_spec.ae; the
 * generator itself is mquickjs-ae's gen/genengine. */
int sae_stdlib_main(int argc, char **argv); /* gen/sae_spec.ae */

int main(int argc, char **argv)
{
    return sae_stdlib_main(argc, argv);
}
