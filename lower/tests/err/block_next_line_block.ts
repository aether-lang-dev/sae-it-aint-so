const g = (body?: () => void) => body;
g { print("one") }
{
  print("two")
}
// error: 3:1: a '{' on the line after a call or a name is ambiguous
