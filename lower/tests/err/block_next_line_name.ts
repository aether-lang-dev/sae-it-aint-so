const g = (body?: () => void) => body;
let x = g
{
  print("wrapped")
}
// error: 3:1: a '{' on the line after a call or a name is ambiguous
