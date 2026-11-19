const scene = (a: string, body?: () => void) => body;
scene("0 0 1 1")
{
  print("wrapped")
}
// error: 3:1: a '{' on the line after a call or a name is ambiguous
