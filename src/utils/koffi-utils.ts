export function wideCharArrayToString(arr: ArrayLike<number>): string {
  const chars: number[] = [];

  for (let i = 0; i < arr.length; i++) {
    const char = arr[i];
    if (char === undefined || char === 0) break;
    chars.push(char);
  }
  return String.fromCharCode(...chars);
}
